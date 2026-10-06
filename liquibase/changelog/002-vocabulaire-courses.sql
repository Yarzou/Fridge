--liquibase formatted sql

-- =============================================
-- 002 : vocabulaire de la liste de courses
--
-- household_aisle_terms gardait seulement le rayon corrigé d'un terme
-- (« comté » → crèmerie). Il compte désormais aussi les ajouts, pour proposer
-- « Souvent achetés » sous le champ de saisie.
--
-- Additif (expand) : sans ces colonnes, l'appli retombe sur le rayon seul et
-- masque les suggestions.
-- =============================================

--changeset fridge:002-aisle-terms-usage
alter table public.household_aisle_terms
    add column if not exists label text check (label is null or length(label) <= 80),
    add column if not exists times_added integer not null default 0 check (times_added >= 0),
    add column if not exists last_added_at timestamptz;
--rollback alter table public.household_aisle_terms drop column if exists last_added_at, drop column if exists times_added, drop column if exists label;

-- Retient le rayon d'un terme et compte un ajout (p_added) en une requête :
-- deux membres qui ajoutent le même article en même temps ne s'écrasent pas.
-- SECURITY INVOKER : la policy household_aisle_terms_all (membre du foyer) s'applique.
--changeset fridge:002-fn-note-shopping-term splitStatements:false
create or replace function public.note_shopping_term(
    p_household uuid,
    p_term text,
    p_label text,
    p_aisle text,
    p_added boolean
)
    returns void
    language sql
    security invoker
    set search_path = public
as $$
    insert into public.household_aisle_terms (household_id, term, aisle_slug, label, times_added, last_added_at, updated_at)
    values (
        p_household,
        p_term,
        p_aisle,
        left(p_label, 80),
        case when p_added then 1 else 0 end,
        case when p_added then now() end,
        now()
    )
    on conflict (household_id, term) do update set
        aisle_slug    = excluded.aisle_slug,
        label         = excluded.label,
        times_added   = public.household_aisle_terms.times_added + excluded.times_added,
        last_added_at = coalesce(excluded.last_added_at, public.household_aisle_terms.last_added_at),
        updated_at    = now()
$$;
--rollback drop function if exists public.note_shopping_term(uuid, text, text, text, boolean);

--changeset fridge:002-grant-note-shopping-term
revoke execute on function public.note_shopping_term(uuid, text, text, text, boolean) from public, anon;
grant execute on function public.note_shopping_term(uuid, text, text, text, boolean) to authenticated;
--rollback revoke execute on function public.note_shopping_term(uuid, text, text, text, boolean) from authenticated;

--changeset fridge:002-reload-schema-cache
select pg_notify('pgrst', 'reload schema');
--rollback select pg_notify('pgrst', 'reload schema');
