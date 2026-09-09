-- Hotel IT Helpdesk - Admin setup
-- IMPORTANT: create these users first from Supabase Dashboard > Authentication > Users.
-- This file promotes the matching profiles to ADMIN and sets the display name.

update public.profiles
set name = 'admin1',
    role = 'ADMIN',
    is_active = true,
    updated_at = now()
where email = 'admin1@marriot.com';

update public.profiles
set name = 'admin2',
    role = 'ADMIN',
    is_active = true,
    updated_at = now()
where email = 'admin2@marriot.com';

-- Verification
select name, email, role, is_active
from public.profiles
where email in ('admin1@marriot.com', 'admin2@marriot.com')
order by name;
