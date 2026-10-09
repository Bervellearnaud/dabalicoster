-- ============================================================
-- DABALICOSTER V2 — Setup Supabase (À COLLER DANS SQL EDITOR)
-- Projet : lbeugbapmruljmekokhj
-- Contenu : tables, index, vues, fonctions d'auth bcrypt (SECURITY
-- DEFINER), politiques RLS, grants, comptes de démonstration hachés.
-- Idempotent : rejouable sans risque (IF NOT EXISTS / OR REPLACE /
-- ON CONFLICT DO NOTHING).
-- ============================================================

create extension if not exists pgcrypto;   -- crypt() / gen_salt() (déjà actif sur Supabase)

-- ------------------------------------------------------------
-- TABLES (miroir du modèle V1 — mot_de_passe = hash bcrypt)
-- ------------------------------------------------------------
create table if not exists public.utilisateurs (
    id              uuid primary key default gen_random_uuid(),
    nom             text not null,
    prenom          text not null,
    email           text not null unique,
    contact         text,
    mot_de_passe    text not null,                -- hash bcrypt, jamais en clair
    role            text not null default 'utilisateur'
                    check (role in ('utilisateur', 'chef', 'administrateur')),
    statut          text not null default 'actif'
                    check (statut in ('actif', 'suspendu')),
    photo           text,
    cree_le         timestamptz not null default now()
);

create table if not exists public.ingredients (
    id              uuid primary key default gen_random_uuid(),
    nom             text not null unique,
    categorie       text not null default 'Autre',
    unite           text not null check (unite in ('kg', 'g', 'L', 'ml', 'piece', 'sachet')),
    prix_unitaire   numeric(12, 2) not null default 0 check (prix_unitaire >= 0),
    fournisseur     text,
    date_prix       date not null default current_date,
    nutrition       jsonb,                        -- null = « donnée indisponible »
    cree_le         timestamptz not null default now()
);

create table if not exists public.historique_prix (
    id              bigserial primary key,
    ingredient_id   uuid not null references public.ingredients(id) on delete cascade,
    date_prix       date not null,
    prix            numeric(12, 2) not null check (prix >= 0),
    unique (ingredient_id, date_prix)
);

create table if not exists public.recettes (
    id              uuid primary key default gen_random_uuid(),
    nom             text not null unique,
    categorie       text not null default 'Plats',
    portions        integer not null default 1 check (portions > 0),
    temps           integer not null default 0,
    instructions    text,
    prix_vente_ht   numeric(12, 2) not null default 0 check (prix_vente_ht >= 0),
    actif           boolean not null default true,
    cree_le         timestamptz not null default now()
);

create table if not exists public.lignes_recette (
    id              bigserial primary key,
    recette_id      uuid not null references public.recettes(id) on delete cascade,
    ingredient_id   uuid not null references public.ingredients(id) on delete restrict,
    quantite        numeric(12, 3) not null check (quantite > 0),
    unite           text not null check (unite in ('kg', 'g', 'L', 'ml', 'piece', 'sachet')),
    unique (recette_id, ingredient_id)
);

create table if not exists public.menus (
    id              uuid primary key default gen_random_uuid(),
    nom             text not null unique,
    cree_le         timestamptz not null default now()
);

create table if not exists public.lignes_menu (
    id              bigserial primary key,
    menu_id         uuid not null references public.menus(id) on delete cascade,
    recette_id      uuid not null references public.recettes(id) on delete cascade,
    quantite        integer not null default 1 check (quantite > 0),
    unique (menu_id, recette_id)
);

create table if not exists public.parametres (
    id                  integer primary key,
    devise              text not null default 'XOF' check (devise in ('XOF', 'EUR', 'USD', 'GBP')),
    objectif_food_cost  numeric(5, 2) not null default 35 check (objectif_food_cost > 0),
    tva                 numeric(5, 2) not null default 18 check (tva >= 0)
);

-- ------------------------------------------------------------
-- INDEX
-- ------------------------------------------------------------
create index if not exists idx_historique_ing_date   on public.historique_prix (ingredient_id, date_prix desc);
create index if not exists idx_lignes_recette_recette on public.lignes_recette (recette_id);
create index if not exists idx_lignes_recette_ing     on public.lignes_recette (ingredient_id);
create index if not exists idx_lignes_menu_menu       on public.lignes_menu (menu_id);
create index if not exists idx_utilisateurs_role      on public.utilisateurs (role);

-- ------------------------------------------------------------
-- VUES = moteur de costing côté base (formules 2, 3, 4 + alertes)
-- ------------------------------------------------------------
create or replace view public.v_cout_recettes as
select
    r.id                                        as recette_id,
    r.nom,
    r.portions,
    r.prix_vente_ht,
    coalesce(sum(
        lr.quantite
        * case lr.unite when 'kg' then 1000 when 'L' then 1000 else 1 end
        / case i.unite  when 'kg' then 1000 when 'L' then 1000 else 1 end
        * i.prix_unitaire
    ), 0)                                       as cout_recette,
    coalesce(sum(
        lr.quantite
        * case lr.unite when 'kg' then 1000 when 'L' then 1000 else 1 end
        / case i.unite  when 'kg' then 1000 when 'L' then 1000 else 1 end
        * i.prix_unitaire
    ), 0) / greatest(r.portions, 1)             as cout_portion,
    case when r.prix_vente_ht > 0 then
        100.0 * (coalesce(sum(
            lr.quantite
            * case lr.unite when 'kg' then 1000 when 'L' then 1000 else 1 end
            / case i.unite  when 'kg' then 1000 when 'L' then 1000 else 1 end
            * i.prix_unitaire
        ), 0) / greatest(r.portions, 1)) / r.prix_vente_ht
    else null end                               as food_cost_pct
from public.recettes r
left join public.lignes_recette lr on lr.recette_id = r.id
left join public.ingredients i     on i.id = lr.ingredient_id
group by r.id, r.nom, r.portions, r.prix_vente_ht;

create or replace view public.v_alertes_prix as
with fenetre as (
    select ingredient_id, prix,
           row_number() over (partition by ingredient_id order by date_prix asc)  as rn_first,
           row_number() over (partition by ingredient_id order by date_prix desc) as rn_last
    from public.historique_prix
    where date_prix >= current_date - interval '30 days'
)
select i.id as ingredient_id, i.nom, f.prix as ancien_prix, l.prix as nouveau_prix,
       round(100.0 * (l.prix - f.prix) / nullif(f.prix, 0), 1) as hausse_pct
from public.ingredients i
join fenetre f on f.ingredient_id = i.id and f.rn_first = 1
join fenetre l on l.ingredient_id = i.id and l.rn_last = 1
where f.prix > 0 and (l.prix - f.prix) / f.prix > 0.05;

-- ------------------------------------------------------------
-- FONCTIONS D'AUTHENTIFICATION (bcrypt côté base, SECURITY DEFINER)
-- Le hash ne sort JAMAIS : ces fonctions renvoient uniquement les
-- champs publics.
-- ------------------------------------------------------------
create or replace function public.register_user(
    p_prenom text, p_nom text, p_email text, p_contact text, p_pwd text, p_role text
) returns table (id uuid, prenom text, nom text, email text, contact text,
                 role text, statut text, photo text, cree_le timestamptz)
language plpgsql security definer set search_path = public as $$
begin
    if p_role not in ('utilisateur', 'chef') then
        raise exception 'Le profil Administrateur ne peut être attribué que par un administrateur.';
    end if;
    if p_prenom is null or trim(p_prenom) = '' or p_nom is null or trim(p_nom) = '' then
        raise exception 'Le prénom et le nom sont obligatoires.';
    end if;
    if p_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]{2,}$' then
        raise exception 'Adresse e-mail invalide.';
    end if;
    if char_length(p_pwd) < 6 or p_pwd !~ '[0-9]' then
        raise exception 'Le mot de passe doit contenir au moins 6 caractères dont 1 chiffre.';
    end if;
    if exists (select 1 from public.utilisateurs where email = lower(p_email)) then
        raise exception 'Cet e-mail est déjà utilisé par un compte existant.';
    end if;
    return query
    insert into public.utilisateurs (prenom, nom, email, contact, mot_de_passe, role, statut)
    values (trim(p_prenom), trim(p_nom), lower(p_email), nullif(trim(coalesce(p_contact,'')), ''),
            crypt(p_pwd, gen_salt('bf', 8)), p_role, 'actif')
    returning utilisateurs.id, utilisateurs.prenom, utilisateurs.nom, utilisateurs.email,
          utilisateurs.contact, utilisateurs.role, utilisateurs.statut, utilisateurs.photo, utilisateurs.cree_le;
end $$;

create or replace function public.login_user(p_email text, p_pwd text)
returns table (id uuid, prenom text, nom text, email text, contact text,
                role text, statut text, photo text, cree_le timestamptz)
language plpgsql security definer set search_path = public as $$
begin
    return query
    select u.id, u.prenom, u.nom, u.email, u.contact, u.role, u.statut, u.photo, u.cree_le
    from public.utilisateurs u
    where u.email = lower(p_email)
      and u.mot_de_passe = crypt(p_pwd, u.mot_de_passe)   -- vérification bcrypt en base
      and u.statut = 'actif';
end $$;

-- Permet au client de distinguer « identifiants incorrects » / « compte suspendu »
create or replace function public.account_status(p_email text) returns text
language plpgsql security definer set search_path = public as $$
declare u public.utilisateurs%rowtype;
begin
    select * into u from public.utilisateurs where email = lower(p_email);
    if not found then return 'inconnu'; end if;
    return u.statut;
end $$;

create or replace function public.get_user(p_id uuid)
returns table (id uuid, prenom text, nom text, email text, contact text,
                role text, statut text, photo text, cree_le timestamptz)
language plpgsql security definer set search_path = public as $$
begin
    return query
    select u.id, u.prenom, u.nom, u.email, u.contact, u.role, u.statut, u.photo, u.cree_le
    from public.utilisateurs u where u.id = p_id;
end $$;

create or replace function public.update_profile(
    p_id uuid, p_prenom text, p_nom text, p_email text,
    p_contact text, p_photo text, p_pwd text
) returns table (id uuid, prenom text, nom text, email text, contact text,
                 role text, statut text, photo text, cree_le timestamptz)
language plpgsql security definer set search_path = public as $$
begin
    if p_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]{2,}$' then raise exception 'Adresse e-mail invalide.'; end if;
    if exists (select 1 from public.utilisateurs where email = lower(p_email) and id <> p_id) then
        raise exception 'Cet e-mail est déjà utilisé par un autre compte.';
    end if;
    if p_pwd is not null and p_pwd <> '' and (char_length(p_pwd) < 6 or p_pwd !~ '[0-9]') then
        raise exception 'Le mot de passe doit contenir au moins 6 caractères dont 1 chiffre.';
    end if;
    return query
    update public.utilisateurs set
        prenom = trim(p_prenom), nom = trim(p_nom), email = lower(p_email),
        contact = nullif(trim(coalesce(p_contact,'')), ''), photo = nullif(trim(coalesce(p_photo,'')), ''),
        mot_de_passe = case when p_pwd is not null and p_pwd <> ''
                       then crypt(p_pwd, gen_salt('bf', 8)) else mot_de_passe end
    where id = p_id
    returning utilisateurs.id, utilisateurs.prenom, utilisateurs.nom, utilisateurs.email,
          utilisateurs.contact, utilisateurs.role, utilisateurs.statut, utilisateurs.photo, utilisateurs.cree_le;
end $$;

create or replace function public.admin_list_users(p_caller_id uuid)
returns table (id uuid, prenom text, nom text, email text, contact text,
                role text, statut text, photo text, cree_le timestamptz)
language plpgsql security definer set search_path = public as $$
begin
    if not exists (select 1 from public.utilisateurs
                   where id = p_caller_id and role = 'administrateur' and statut = 'actif') then
        raise exception 'Accès refusé : privilèges administrateur requis.';
    end if;
    return query
    select u.id, u.prenom, u.nom, u.email, u.contact, u.role, u.statut, u.photo, u.cree_le
    from public.utilisateurs u order by u.cree_le, u.nom;
end $$;

create or replace function public.admin_upsert_user(
    p_caller_id uuid, p_id uuid, p_prenom text, p_nom text, p_email text, p_contact text,
    p_role text, p_statut text, p_photo text, p_pwd text
) returns table (id uuid, prenom text, nom text, email text, contact text,
                 role text, statut text, photo text, cree_le timestamptz)
language plpgsql security definer set search_path = public as $$
begin
    if not exists (select 1 from public.utilisateurs
                   where id = p_caller_id and role = 'administrateur' and statut = 'actif') then
        raise exception 'Accès refusé : privilèges administrateur requis.';
    end if;
    if p_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]{2,}$' then raise exception 'Adresse e-mail invalide.'; end if;
    if exists (select 1 from public.utilisateurs where email = lower(p_email) and id is distinct from p_id) then
        raise exception 'Cet e-mail est déjà utilisé par un autre compte.';
    end if;
    if p_id is null then
        if p_pwd is null or char_length(p_pwd) < 6 or p_pwd !~ '[0-9'']' then
            raise exception 'Le mot de passe doit contenir au moins 6 caractères dont 1 chiffre.';
        end if;
        return query
        insert into public.utilisateurs (prenom, nom, email, contact, mot_de_passe, role, statut, photo)
        values (trim(p_prenom), trim(p_nom), lower(p_email), nullif(trim(coalesce(p_contact,'')), ''),
                crypt(p_pwd, gen_salt('bf', 8)), p_role, p_statut, nullif(trim(coalesce(p_photo,'')), ''))
        returning utilisateurs.id, utilisateurs.prenom, utilisateurs.nom, utilisateurs.email,
              utilisateurs.contact, utilisateurs.role, utilisateurs.statut, utilisateurs.photo, utilisateurs.cree_le;
    else
        if p_id = p_caller_id then
            -- interdiction de se rétrograder / se suspendre soi-même
            return query
            update public.utilisateurs set
                prenom = trim(p_prenom), nom = trim(p_nom), email = lower(p_email),
                contact = nullif(trim(coalesce(p_contact,'')), ''), photo = nullif(trim(coalesce(p_photo,'')), ''),
                mot_de_passe = case when p_pwd is not null and p_pwd <> ''
                               then crypt(p_pwd, gen_salt('bf', 8)) else mot_de_passe end
            where id = p_id
            returning utilisateurs.id, utilisateurs.prenom, utilisateurs.nom, utilisateurs.email,
                  utilisateurs.contact, utilisateurs.role, utilisateurs.statut, utilisateurs.photo, utilisateurs.cree_le;
        else
            return query
            update public.utilisateurs set
                prenom = trim(p_prenom), nom = trim(p_nom), email = lower(p_email),
                contact = nullif(trim(coalesce(p_contact,'')), ''), photo = nullif(trim(coalesce(p_photo,'')), ''),
                role = p_role, statut = p_statut,
                mot_de_passe = case when p_pwd is not null and p_pwd <> ''
                               then crypt(p_pwd, gen_salt('bf', 8)) else mot_de_passe end
            where id = p_id
            returning utilisateurs.id, utilisateurs.prenom, utilisateurs.nom, utilisateurs.email,
                  utilisateurs.contact, utilisateurs.role, utilisateurs.statut, utilisateurs.photo, utilisateurs.cree_le;
        end if;
    end if;
end $$;

create or replace function public.admin_delete_user(p_caller_id uuid, p_id uuid) returns boolean
language plpgsql security definer set search_path = public as $$
begin
    if not exists (select 1 from public.utilisateurs
                   where id = p_caller_id and role = 'administrateur' and statut = 'actif') then
        raise exception 'Accès refusé : privilèges administrateur requis.';
    end if;
    if p_id = p_caller_id then
        raise exception 'Vous ne pouvez pas supprimer votre propre compte.';
    end if;
    delete from public.utilisateurs where id = p_id;
    return true;
end $$;

-- ------------------------------------------------------------
-- RLS : la table utilisateurs est INACCESSIBLE en direct (uniquement
-- via les fonctions DEFINER ci-dessus). Les tables métier restent
-- lisibles/écritables par la clé publishable (niveau de confiance V1,
-- à durcir en V3 avec de vraies sessions JWT).
-- ------------------------------------------------------------
alter table public.utilisateurs enable row level security;   -- aucune policy volontairement

do $$
declare t text;
begin
    foreach t in array array['ingredients','historique_prix','recettes','lignes_recette','menus','lignes_menu','parametres'] loop
        execute format('alter table public.%I enable row level security', t);
        execute format('drop policy if exists demo_select on public.%I', t);
        execute format('create policy demo_select on public.%I for select to anon, authenticated using (true)', t);
        execute format('drop policy if exists demo_insert on public.%I', t);
        execute format('create policy demo_insert on public.%I for insert to anon, authenticated with check (true)', t);
        execute format('drop policy if exists demo_update on public.%I', t);
        execute format('create policy demo_update on public.%I for update to anon, authenticated using (true) with check (true)', t);
        execute format('drop policy if exists demo_delete on public.%I', t);
        execute format('create policy demo_delete on public.%I for delete to anon, authenticated using (true)', t);
    end loop;
end $$;

-- ------------------------------------------------------------
-- GRANTS
-- ------------------------------------------------------------
grant select, insert, update, delete
    on public.ingredients, public.historique_prix, public.recettes,
       public.lignes_recette, public.menus, public.lignes_menu, public.parametres
    to anon, authenticated;
grant select on public.v_cout_recettes, public.v_alertes_prix to anon, authenticated;
grant execute on all functions in schema public to anon, authenticated;

-- ------------------------------------------------------------
-- COMPTES DE DÉMONSTRATION (mots de passe hachés bcrypt en base)
-- ------------------------------------------------------------
insert into public.utilisateurs (id, prenom, nom, email, contact, mot_de_passe, role, statut, cree_le) values
 ('00000000-0000-4000-8000-000000000001', 'N''Guessan', 'Kouassi', 'chef@dabalicoster.ci',  '+225 07 08 09 10 11', crypt('chef2026',      gen_salt('bf', 8)), 'chef',           'actif',     '2026-08-01'),
 ('00000000-0000-4000-8000-000000000002', 'Awa',       'Traoré',  'user@dabalicoster.ci',  '+225 05 06 07 08 09', crypt('user2026',      gen_salt('bf', 8)), 'utilisateur',    'actif',     '2026-08-12'),
 ('00000000-0000-4000-8000-000000000003', 'Yves',      'VOOMNET', 'admin@voomnet.ci',      '+225 27 22 44 55 66', crypt('admin2026',     gen_salt('bf', 8)), 'administrateur', 'actif',     '2026-07-15'),
 ('00000000-0000-4000-8000-000000000004', 'Kouadio',   'Yao',     'stagiaire@dabalicoster.ci', '+225 01 02 03 04 05', crypt('stagiaire2026', gen_salt('bf', 8)), 'utilisateur',  'suspendu',  '2026-09-02')
on conflict (id) do nothing;

-- ============================================================
-- FIN — coller ensuite seed_data.sql (données métier de démo)
-- ============================================================
