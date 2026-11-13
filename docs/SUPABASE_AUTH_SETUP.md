HOPTYM — Supabase Auth deployment checklist

Project: aliploqizujgovnlgjvg (EU Central).

Set in local development and Vercel:
VITE_SUPABASE_URL=https://aliploqizujgovnlgjvg.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=the sb_publishable key from Supabase Connect / API Keys.
Never expose service_role or sb_secret in browser code.

Required dashboard steps before launch:
1. Keep Email/password provider enabled.
2. Turn OFF public signups; create accounts only by administrator invitation.
3. Set production Site URL and exact redirect allow-list entries for production and approved preview/dev URLs.
4. Configure production SMTP for invitations and password recovery.
5. Invite first user in Authentication > Users. Trigger creates least-privileged revenue_manager profile.
6. Assign admin/super_admin only through trusted server-side process, never browser metadata or user-editable profile fields.
7. After inviting the first owner account, run this once in SQL Editor (replace the email and organization name):

insert into public.organizations (name, slug) values ('Flowtym', 'flowtym') on conflict (slug) do nothing;
update public.users set organization_id = (select id from public.organizations where slug = 'flowtym'), role = 'super_admin' where email = 'owner@example.com';

Verify exactly one user row was updated. Do not use this bootstrap query for ordinary users.

The app verifies sessions using auth.getUser, waits for the matching Flowtym profile, and allows users to SELECT only their own profile. Client-side role/org updates are not granted. Password reset and update flows use Supabase Auth.

Protected React rendering is not database authorization. Before exposing business data, enable RLS on every exposed table and add tenant-scoped policies for every SELECT/INSERT/UPDATE/DELETE path. Existing schema.sql is a design file and is not deployed by this auth change. Do not use blanket USING (true) policies for business data.
