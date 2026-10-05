--liquibase formatted sql

-- =============================================
-- 001 : schéma initial de Fridge
--
-- Tout appartient à un FOYER (household). Un compte rejoint un foyer en le
-- créant (create_household) ou par un lien d'invitation (accept_invitation).
-- Le RLS est le seul verrou : chaque table de données porte household_id et
-- n'est lisible ou modifiable que par les membres du foyer.
--
-- Deux tables de référence restent lisibles sans compte : categories et
-- aisles. /api/keepalive interroge categories avec la clé anon, ne pas la fermer.
--
-- Cohérence des rattachements par clés étrangères composites : un tiroir
-- appartient au foyer de son congélateur, un produit au foyer et au
-- congélateur de son tiroir. Une incohérence est refusée par la base, pas
-- seulement par l'UI.
-- =============================================

--changeset fridge:001-profiles
create table if not exists public.profiles (
    id           uuid primary key references auth.users(id) on delete cascade,
    display_name text not null,
    created_at   timestamptz not null default now()
);
alter table public.profiles enable row level security;
--rollback drop table if exists public.profiles;

--changeset fridge:001-fn-handle-new-user splitStatements:false
create or replace function public.handle_new_user()
    returns trigger
    language plpgsql
    security definer
    set search_path = public
as $func$
begin
    insert into public.profiles (id, display_name)
    values (
        new.id,
        coalesce(nullif(trim(new.raw_user_meta_data->>'display_name'), ''), split_part(new.email, '@', 1))
    )
    on conflict (id) do nothing;
    return new;
end;
$func$;
--rollback drop function if exists public.handle_new_user();

--changeset fridge:001-trigger-handle-new-user
create trigger on_auth_user_created
    after insert on auth.users
    for each row execute function public.handle_new_user();
--rollback drop trigger if exists on_auth_user_created on auth.users;

--changeset fridge:001-households
create table if not exists public.households (
    id         uuid primary key default gen_random_uuid(),
    name       text not null check (length(trim(name)) between 1 and 60),
    created_by uuid references public.profiles(id) on delete set null,
    created_at timestamptz not null default now()
);

create table if not exists public.household_members (
    household_id uuid not null references public.households(id) on delete cascade,
    user_id      uuid not null references public.profiles(id) on delete cascade,
    -- admin : invite, retire des membres, renomme le foyer · membre : tout le reste
    role         text not null default 'membre' check (role in ('admin', 'membre')),
    joined_at    timestamptz not null default now(),
    primary key (household_id, user_id)
);
create index if not exists household_members_user_idx on public.household_members (user_id);

alter table public.households enable row level security;
alter table public.household_members enable row level security;
--rollback drop table if exists public.household_members;
--rollback drop table if exists public.households;

-- Les trois fonctions d'appartenance sont SECURITY DEFINER : les policies de
-- household_members s'appuient dessus, une sous-requête directe tournerait en
-- récursion RLS.
--changeset fridge:001-fn-is-household-member splitStatements:false
create or replace function public.is_household_member(p_household uuid)
    returns boolean
    language sql
    stable
    security definer
    set search_path = public
as $$
    select exists (
        select 1 from public.household_members m
        where m.household_id = p_household and m.user_id = auth.uid()
    )
$$;
--rollback drop function if exists public.is_household_member(uuid);

--changeset fridge:001-fn-is-household-admin splitStatements:false
create or replace function public.is_household_admin(p_household uuid)
    returns boolean
    language sql
    stable
    security definer
    set search_path = public
as $$
    select exists (
        select 1 from public.household_members m
        where m.household_id = p_household and m.user_id = auth.uid() and m.role = 'admin'
    )
$$;
--rollback drop function if exists public.is_household_admin(uuid);

-- Deux comptes partagent-ils au moins un foyer ? (lecture des noms des co-membres)
--changeset fridge:001-fn-shares-household splitStatements:false
create or replace function public.shares_household(p_user uuid)
    returns boolean
    language sql
    stable
    security definer
    set search_path = public
as $$
    select exists (
        select 1
        from public.household_members mine
        join public.household_members theirs on theirs.household_id = mine.household_id
        where mine.user_id = auth.uid() and theirs.user_id = p_user
    )
$$;
--rollback drop function if exists public.shares_household(uuid);

--changeset fridge:001-grant-membership-fns
revoke execute on function public.is_household_member(uuid) from public, anon;
revoke execute on function public.is_household_admin(uuid) from public, anon;
revoke execute on function public.shares_household(uuid) from public, anon;
grant execute on function public.is_household_member(uuid) to authenticated;
grant execute on function public.is_household_admin(uuid) to authenticated;
grant execute on function public.shares_household(uuid) to authenticated;
--rollback revoke execute on function public.shares_household(uuid) from authenticated;
--rollback revoke execute on function public.is_household_admin(uuid) from authenticated;
--rollback revoke execute on function public.is_household_member(uuid) from authenticated;

--changeset fridge:001-rls-profiles-households
create policy "profiles_select" on public.profiles
    for select to authenticated
    using (id = auth.uid() or public.shares_household(id));
create policy "profiles_update" on public.profiles
    for update to authenticated
    using (id = auth.uid()) with check (id = auth.uid());

create policy "households_select" on public.households
    for select to authenticated using (public.is_household_member(id));
create policy "households_update" on public.households
    for update to authenticated using (public.is_household_admin(id));
create policy "households_delete" on public.households
    for delete to authenticated using (public.is_household_admin(id));

-- Pas de policy d'insert : un foyer naît par create_household(), qui pose
-- son premier admin dans la même transaction. Un membre entre par
-- accept_invitation(). On quitte le foyer soi-même, ou un admin vous retire.
create policy "household_members_select" on public.household_members
    for select to authenticated using (public.is_household_member(household_id));
create policy "household_members_delete" on public.household_members
    for delete to authenticated
    using (user_id = auth.uid() or public.is_household_admin(household_id));
--rollback drop policy if exists "household_members_delete" on public.household_members;
--rollback drop policy if exists "household_members_select" on public.household_members;
--rollback drop policy if exists "households_delete" on public.households;
--rollback drop policy if exists "households_update" on public.households;
--rollback drop policy if exists "households_select" on public.households;
--rollback drop policy if exists "profiles_update" on public.profiles;
--rollback drop policy if exists "profiles_select" on public.profiles;

--changeset fridge:001-invitations
-- L'id de l'invitation EST le jeton du lien (/invitation/{id}) : 122 bits
-- aléatoires, non devinables. Réutilisable par plusieurs personnes jusqu'à
-- expiration ; le supprimer révoque le lien.
create table if not exists public.household_invitations (
    id           uuid primary key default gen_random_uuid(),
    household_id uuid not null references public.households(id) on delete cascade,
    created_by   uuid references public.profiles(id) on delete set null,
    expires_at   timestamptz not null default (now() + interval '7 days'),
    created_at   timestamptz not null default now()
);
create index if not exists household_invitations_household_idx on public.household_invitations (household_id);
alter table public.household_invitations enable row level security;

create policy "invitations_select" on public.household_invitations
    for select to authenticated using (public.is_household_admin(household_id));
create policy "invitations_insert" on public.household_invitations
    for insert to authenticated
    with check (created_by = auth.uid() and public.is_household_admin(household_id));
create policy "invitations_delete" on public.household_invitations
    for delete to authenticated using (public.is_household_admin(household_id));
--rollback drop table if exists public.household_invitations;

--changeset fridge:001-reference-tables
-- Catégories du congélateur. Icônes et couleurs vivent dans le code
-- (lib/categories.ts) ; la base porte le slug, le libellé et la durée de
-- conservation par défaut, en mois.
create table if not exists public.categories (
    slug          text primary key,
    label         text not null,
    shelf_months  integer not null check (shelf_months > 0),
    sort_order    integer not null
);
insert into public.categories (slug, label, shelf_months, sort_order) values
    ('viandes',      'Viandes',      6,  1),
    ('poissons',     'Poissons',     4,  2),
    ('legumes',      'Légumes',      10, 3),
    ('fruits',       'Fruits',       10, 4),
    ('plats-maison', 'Plats maison', 3,  5),
    ('pain',         'Pain',         3,  6),
    ('glaces',       'Glaces',       3,  7),
    ('herbes',       'Herbes',       6,  8),
    ('autres',       'Autres',       6,  9)
on conflict (slug) do nothing;

-- Rayons de la liste de courses, dans l'ordre d'un parcours en magasin :
-- surgelés en dernier, pour la chaîne du froid.
create table if not exists public.aisles (
    slug       text primary key,
    label      text not null,
    sort_order integer not null
);
insert into public.aisles (slug, label, sort_order) values
    ('fruits-legumes', 'Fruits et légumes', 1),
    ('boulangerie',    'Boulangerie',       2),
    ('boucherie',      'Boucherie',         3),
    ('poissonnerie',   'Poissonnerie',      4),
    ('cremerie',       'Crèmerie',          5),
    ('epicerie-salee', 'Épicerie salée',    6),
    ('epicerie-sucree','Épicerie sucrée',   7),
    ('boissons',       'Boissons',          8),
    ('hygiene',        'Hygiène',           9),
    ('entretien',      'Entretien',         10),
    ('surgeles',       'Surgelés',          11),
    ('divers',         'Divers',            12)
on conflict (slug) do nothing;

alter table public.categories enable row level security;
alter table public.aisles enable row level security;
create policy "categories_select" on public.categories for select to anon, authenticated using (true);
create policy "aisles_select" on public.aisles for select to anon, authenticated using (true);
--rollback drop table if exists public.aisles;
--rollback drop table if exists public.categories;

--changeset fridge:001-freezers
create table if not exists public.freezers (
    id           uuid primary key default gen_random_uuid(),
    household_id uuid not null references public.households(id) on delete cascade,
    name         text not null check (length(trim(name)) between 1 and 40),
    position     integer not null default 0,
    created_at   timestamptz not null default now(),
    unique (id, household_id)
);
create index if not exists freezers_household_idx on public.freezers (household_id);

-- Tiroirs (ou étagères, ou porte). Leur QR code mène à /tiroir/{id}.
create table if not exists public.compartments (
    id           uuid primary key default gen_random_uuid(),
    freezer_id   uuid not null,
    household_id uuid not null,
    name         text not null check (length(trim(name)) between 1 and 40),
    position     integer not null default 0,
    created_at   timestamptz not null default now(),
    foreign key (freezer_id, household_id) references public.freezers (id, household_id) on delete cascade,
    unique (id, freezer_id, household_id)
);
create index if not exists compartments_freezer_idx on public.compartments (freezer_id);

alter table public.freezers enable row level security;
alter table public.compartments enable row level security;

create policy "freezers_all" on public.freezers
    for all to authenticated
    using (public.is_household_member(household_id))
    with check (public.is_household_member(household_id));
create policy "compartments_all" on public.compartments
    for all to authenticated
    using (public.is_household_member(household_id))
    with check (public.is_household_member(household_id));
--rollback drop table if exists public.compartments;
--rollback drop table if exists public.freezers;

--changeset fridge:001-fn-touch-updated-at splitStatements:false
create or replace function public.touch_updated_at()
    returns trigger
    language plpgsql
as $func$
begin
    new.updated_at = now();
    return new;
end;
$func$;
--rollback drop function if exists public.touch_updated_at();

--changeset fridge:001-items
-- Un produit rangé. quantity = 0 : sorti en entier. La ligne reste (annuler,
-- retrouver le nom ou la catégorie d'un code-barres déjà scanné) et l'UI la masque.
create table if not exists public.items (
    id             uuid primary key default gen_random_uuid(),
    household_id   uuid not null,
    freezer_id     uuid not null,
    compartment_id uuid,
    category_slug  text not null default 'autres' references public.categories(slug),
    name           text not null check (length(trim(name)) between 1 and 80),
    quantity       integer not null default 1 check (quantity >= 0),
    -- « sachet », « portion »… libre, null = unités simples
    unit           text check (unit is null or length(unit) <= 20),
    barcode        text check (barcode is null or barcode ~ '^[0-9]{6,14}$'),
    image_url      text,
    frozen_on      date not null default current_date,
    best_before    date,
    added_by       uuid references public.profiles(id) on delete set null,
    created_at     timestamptz not null default now(),
    updated_at     timestamptz not null default now(),
    foreign key (freezer_id, household_id) references public.freezers (id, household_id) on delete cascade,
    -- Supprimer un tiroir détache ses produits sans toucher au congélateur (PG 15+)
    foreign key (compartment_id, freezer_id, household_id)
        references public.compartments (id, freezer_id, household_id) on delete set null (compartment_id)
);
create index if not exists items_household_idx on public.items (household_id) where quantity > 0;
create index if not exists items_compartment_idx on public.items (compartment_id);
create index if not exists items_barcode_idx on public.items (household_id, barcode) where barcode is not null;

create trigger items_touch_updated_at
    before update on public.items
    for each row execute function public.touch_updated_at();

alter table public.items enable row level security;
create policy "items_all" on public.items
    for all to authenticated
    using (public.is_household_member(household_id))
    with check (public.is_household_member(household_id));
--rollback drop table if exists public.items;

--changeset fridge:001-shopping-items
-- Une seule liste de courses par foyer.
create table if not exists public.shopping_items (
    id            uuid primary key default gen_random_uuid(),
    household_id  uuid not null references public.households(id) on delete cascade,
    name          text not null check (length(trim(name)) between 1 and 80),
    aisle_slug    text not null default 'divers' references public.aisles(slug),
    note          text check (note is null or length(note) <= 40),
    checked       boolean not null default false,
    checked_at    timestamptz,
    -- Ajouté depuis le congélateur (« plus rien en stock ») : permet de
    -- reranger l'article acheté avec la bonne catégorie, en un geste.
    from_item_id  uuid references public.items(id) on delete set null,
    added_by      uuid references public.profiles(id) on delete set null,
    created_at    timestamptz not null default now(),
    updated_at    timestamptz not null default now()
);
create index if not exists shopping_items_household_idx on public.shopping_items (household_id);

create trigger shopping_items_touch_updated_at
    before update on public.shopping_items
    for each row execute function public.touch_updated_at();

-- Ce que le foyer a corrigé : « comté » rangé une fois en crèmerie le reste.
create table if not exists public.household_aisle_terms (
    household_id uuid not null references public.households(id) on delete cascade,
    term         text not null check (length(term) between 1 and 80),
    aisle_slug   text not null references public.aisles(slug),
    updated_at   timestamptz not null default now(),
    primary key (household_id, term)
);

alter table public.shopping_items enable row level security;
alter table public.household_aisle_terms enable row level security;
create policy "shopping_items_all" on public.shopping_items
    for all to authenticated
    using (public.is_household_member(household_id))
    with check (public.is_household_member(household_id));
create policy "household_aisle_terms_all" on public.household_aisle_terms
    for all to authenticated
    using (public.is_household_member(household_id))
    with check (public.is_household_member(household_id));
--rollback drop table if exists public.household_aisle_terms;
--rollback drop table if exists public.shopping_items;

-- Crée le foyer, pose l'appelant en admin et prépare un congélateur avec ses
-- tiroirs, en une transaction.
--changeset fridge:001-fn-create-household splitStatements:false
create or replace function public.create_household(
    p_name text,
    p_freezer_name text default 'Congélateur',
    p_compartments integer default 3
)
    returns uuid
    language plpgsql
    security definer
    set search_path = public
as $func$
declare
    v_user uuid := auth.uid();
    v_household uuid;
    v_freezer uuid;
    i integer;
begin
    if v_user is null then
        raise exception 'not_authenticated' using errcode = '28000';
    end if;
    if p_compartments is null or p_compartments < 0 or p_compartments > 12 then
        raise exception 'invalid_compartments' using errcode = '22023';
    end if;

    insert into public.households (name, created_by)
    values (trim(p_name), v_user)
    returning id into v_household;

    insert into public.household_members (household_id, user_id, role)
    values (v_household, v_user, 'admin');

    insert into public.freezers (household_id, name)
    values (v_household, coalesce(nullif(trim(p_freezer_name), ''), 'Congélateur'))
    returning id into v_freezer;

    for i in 1..p_compartments loop
        insert into public.compartments (freezer_id, household_id, name, position)
        values (v_freezer, v_household, 'Tiroir ' || i, i);
    end loop;

    return v_household;
end;
$func$;
--rollback drop function if exists public.create_household(text, text, integer);

-- Aperçu d'une invitation pour la page /invitation/{id}, avant connexion :
-- nom du foyer et de la personne qui invite. Rien d'autre ne sort.
--changeset fridge:001-fn-invitation-preview splitStatements:false
create or replace function public.invitation_preview(p_invitation uuid)
    returns table (household_name text, invited_by text, expires_at timestamptz, is_valid boolean)
    language sql
    stable
    security definer
    set search_path = public
as $$
    select h.name, p.display_name, i.expires_at, i.expires_at > now()
    from public.household_invitations i
    join public.households h on h.id = i.household_id
    left join public.profiles p on p.id = i.created_by
    where i.id = p_invitation
$$;
--rollback drop function if exists public.invitation_preview(uuid);

--changeset fridge:001-fn-accept-invitation splitStatements:false
create or replace function public.accept_invitation(p_invitation uuid)
    returns uuid
    language plpgsql
    security definer
    set search_path = public
as $func$
declare
    v_user uuid := auth.uid();
    v_household uuid;
begin
    if v_user is null then
        raise exception 'not_authenticated' using errcode = '28000';
    end if;

    select i.household_id into v_household
    from public.household_invitations i
    where i.id = p_invitation and i.expires_at > now();

    if v_household is null then
        raise exception 'invitation_invalid' using errcode = 'P0002';
    end if;

    insert into public.household_members (household_id, user_id, role)
    values (v_household, v_user, 'membre')
    on conflict (household_id, user_id) do nothing;

    return v_household;
end;
$func$;
--rollback drop function if exists public.accept_invitation(uuid);

-- −1 à la sortie, +1 pour « Annuler ». Calcul côté base : deux membres qui
-- sortent le même produit au même moment ne s'écrasent pas.
-- SECURITY INVOKER : le RLS de items s'applique, rien à revérifier ici.
--changeset fridge:001-fn-adjust-item-quantity splitStatements:false
create or replace function public.adjust_item_quantity(p_item uuid, p_delta integer)
    returns integer
    language sql
    security invoker
    set search_path = public
as $$
    update public.items
    set quantity = greatest(quantity + p_delta, 0)
    where id = p_item
    returning quantity
$$;
--rollback drop function if exists public.adjust_item_quantity(uuid, integer);

--changeset fridge:001-grant-rpcs
revoke execute on function public.create_household(text, text, integer) from public, anon;
revoke execute on function public.accept_invitation(uuid) from public, anon;
revoke execute on function public.adjust_item_quantity(uuid, integer) from public, anon;
revoke execute on function public.invitation_preview(uuid) from public;
grant execute on function public.create_household(text, text, integer) to authenticated;
grant execute on function public.accept_invitation(uuid) to authenticated;
grant execute on function public.adjust_item_quantity(uuid, integer) to authenticated;
grant execute on function public.invitation_preview(uuid) to anon, authenticated;
--rollback revoke execute on function public.invitation_preview(uuid) from anon, authenticated;
--rollback revoke execute on function public.adjust_item_quantity(uuid, integer) from authenticated;
--rollback revoke execute on function public.accept_invitation(uuid) from authenticated;
--rollback revoke execute on function public.create_household(text, text, integer) from authenticated;

--changeset fridge:001-realtime
-- Un membre fait les courses pendant qu'un autre vide le congélateur : les
-- deux listes se mettent à jour en direct. Une table absente de cette
-- publication ne lève aucune erreur côté client, elle ne notifie jamais.
alter publication supabase_realtime add table public.items, public.shopping_items;
--rollback alter publication supabase_realtime drop table public.items, public.shopping_items;

--changeset fridge:001-reload-schema-cache
select pg_notify('pgrst', 'reload schema');
--rollback select pg_notify('pgrst', 'reload schema');
