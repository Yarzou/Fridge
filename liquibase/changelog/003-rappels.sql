--liquibase formatted sql

-- =============================================
-- 003 : rappels sur le téléphone (Web Push)
--
-- push_subscriptions : un abonnement Web Push par appareil (l'équivalent des
-- fcm_tokens de neighborshare, mais en Web Push standard, sans Firebase).
-- reminder_settings : les réglages de chaque personne (produits à consommer,
-- récapitulatif), et ce qui lui a déjà été envoyé.
--
-- Additif (expand) : sans ces tables, l'appli affiche « Bientôt » dans la
-- section Rappels et /api/rappels ne fait rien.
-- =============================================

-- L'endpoint est l'adresse secrète que le service push du navigateur donne à
-- l'appareil : qui la connaît peut lui écrire. Il n'est lisible que par son
-- propriétaire ; l'envoi lit la table avec la clé serveur.
--changeset fridge:003-push-subscriptions
create table if not exists public.push_subscriptions (
    id           uuid primary key default gen_random_uuid(),
    user_id      uuid not null references public.profiles(id) on delete cascade,
    endpoint     text not null unique check (endpoint like 'https://%' and length(endpoint) <= 1000),
    p256dh       text not null check (length(p256dh) <= 200),
    auth         text not null check (length(auth) <= 100),
    device_label text check (device_label is null or length(device_label) <= 60),
    created_at   timestamptz not null default now(),
    last_seen_at timestamptz not null default now()
);
create index if not exists push_subscriptions_user_idx on public.push_subscriptions (user_id);
alter table public.push_subscriptions enable row level security;

-- Pas de policy d'insert ni d'update : on enregistre un appareil par
-- save_push_subscription(), qui le reprend s'il était à un autre compte.
create policy "push_subscriptions_select" on public.push_subscriptions
    for select to authenticated using (user_id = auth.uid());
create policy "push_subscriptions_delete" on public.push_subscriptions
    for delete to authenticated using (user_id = auth.uid());
--rollback drop table if exists public.push_subscriptions;

-- Les dates « déjà envoyé » partent du 1er janvier 1970 plutôt que de null :
-- l'envoi réserve sa journée par un simple « update … where date < aujourd'hui »,
-- et deux appels simultanés n'envoient pas deux fois.
--changeset fridge:003-reminder-settings
create table if not exists public.reminder_settings (
    user_id                uuid primary key references public.profiles(id) on delete cascade,
    expiry_enabled         boolean not null default true,
    expiry_days_before     integer not null default 3 check (expiry_days_before between 0 and 30),
    expiry_hour            integer not null default 18 check (expiry_hour between 0 and 23),
    recap_enabled          boolean not null default true,
    recap_weekday          integer not null default 1 check (recap_weekday between 1 and 7),
    recap_hour             integer not null default 18 check (recap_hour between 0 and 23),
    timezone               text not null default 'Europe/Paris' check (length(timezone) between 1 and 60),
    expiry_last_sent_on    date not null default '1970-01-01',
    expiry_announced_until date not null default '1970-01-01',
    recap_last_sent_on     date not null default '1970-01-01',
    updated_at             timestamptz not null default now()
);

create trigger reminder_settings_touch_updated_at
    before update on public.reminder_settings
    for each row execute function public.touch_updated_at();

alter table public.reminder_settings enable row level security;
create policy "reminder_settings_select" on public.reminder_settings
    for select to authenticated using (user_id = auth.uid());
create policy "reminder_settings_insert" on public.reminder_settings
    for insert to authenticated with check (user_id = auth.uid());
create policy "reminder_settings_update" on public.reminder_settings
    for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
--rollback drop table if exists public.reminder_settings;

-- Enregistre l'appareil courant pour l'appelant. Un endpoint déjà connu change
-- de propriétaire : c'est le cas d'un téléphone partagé, où l'on se déconnecte
-- d'un compte pour un autre.
--changeset fridge:003-fn-save-push-subscription splitStatements:false
create or replace function public.save_push_subscription(
    p_endpoint text,
    p_p256dh text,
    p_auth text,
    p_device_label text default null
)
    returns uuid
    language plpgsql
    security definer
    set search_path = public
as $func$
declare
    v_user uuid := auth.uid();
    v_id uuid;
begin
    if v_user is null then
        raise exception 'not_authenticated' using errcode = '28000';
    end if;

    insert into public.push_subscriptions (user_id, endpoint, p256dh, auth, device_label)
    values (v_user, p_endpoint, p_p256dh, p_auth, left(p_device_label, 60))
    on conflict (endpoint) do update set
        user_id      = excluded.user_id,
        p256dh       = excluded.p256dh,
        auth         = excluded.auth,
        device_label = excluded.device_label,
        last_seen_at = now()
    returning id into v_id;

    return v_id;
end;
$func$;
--rollback drop function if exists public.save_push_subscription(text, text, text, text);

--changeset fridge:003-grant-save-push-subscription
revoke execute on function public.save_push_subscription(text, text, text, text) from public, anon;
grant execute on function public.save_push_subscription(text, text, text, text) to authenticated;
--rollback revoke execute on function public.save_push_subscription(text, text, text, text) from authenticated;

--changeset fridge:003-reload-schema-cache
select pg_notify('pgrst', 'reload schema');
--rollback select pg_notify('pgrst', 'reload schema');
