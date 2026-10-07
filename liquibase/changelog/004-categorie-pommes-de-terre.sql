--liquibase formatted sql

-- =============================================
-- 004 : catégorie « Pommes de terre »
--
-- Frites, potatoes, rösti, pommes noisettes… Elles allaient jusqu'ici dans
-- Légumes. La catégorie se place juste après Légumes : les suivantes
-- descendent d'un rang.
--
-- Additif (expand) : tant que cette migration manque, l'appli range ces
-- produits dans Légumes (lib/categories.ts, `fallback`). Le retour arrière
-- les y remet aussi.
-- =============================================

--changeset fridge:004-categorie-pommes-de-terre
update public.categories
   set sort_order = sort_order + 1
 where sort_order > (select sort_order from public.categories where slug = 'legumes');
insert into public.categories (slug, label, shelf_months, sort_order)
select 'pommes-de-terre', 'Pommes de terre', 12, sort_order + 1
  from public.categories
 where slug = 'legumes'
on conflict (slug) do nothing;
--rollback update public.items set category_slug = 'legumes' where category_slug = 'pommes-de-terre';
--rollback delete from public.categories where slug = 'pommes-de-terre';
--rollback update public.categories set sort_order = sort_order - 1 where sort_order > (select sort_order from public.categories where slug = 'legumes') + 1;
