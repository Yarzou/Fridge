--liquibase formatted sql

-- =============================================
-- 005 : rayon « Frais » de la liste de courses
--
-- Pizzas et plats du traiteur, pâtes fraîches, pâte à tarte, taboulé…
-- achetés au froid sans être surgelés. Ils allaient jusqu'ici dans Divers.
-- Le rayon se place juste après Crèmerie, comme en magasin : les suivants
-- descendent d'un rang.
--
-- Additif (expand) : tant que cette migration manque, l'appli range ces
-- articles dans Divers (lib/aisles.ts, `fallback`). Le retour arrière les
-- y remet aussi, avec les termes retenus par le foyer.
-- =============================================

--changeset fridge:005-rayon-frais
update public.aisles
   set sort_order = sort_order + 1
 where sort_order > (select sort_order from public.aisles where slug = 'cremerie');
insert into public.aisles (slug, label, sort_order)
select 'frais', 'Frais', sort_order + 1
  from public.aisles
 where slug = 'cremerie'
on conflict (slug) do nothing;
--rollback update public.shopping_items set aisle_slug = 'divers' where aisle_slug = 'frais';
--rollback update public.household_aisle_terms set aisle_slug = 'divers' where aisle_slug = 'frais';
--rollback delete from public.aisles where slug = 'frais';
--rollback update public.aisles set sort_order = sort_order - 1 where sort_order > (select sort_order from public.aisles where slug = 'cremerie') + 1;
