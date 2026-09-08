-- Who may read the funnel. Kept in its own migration so that granting a person
-- admin over every player's data is a one-line, reviewable change.
insert into admins (user_id)
select id from auth.users where email = 'parthbhodia13@gmail.com'
on conflict (user_id) do nothing;
