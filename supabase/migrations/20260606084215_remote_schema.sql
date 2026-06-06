drop extension if exists "pg_net";

drop policy "Enable read access for all users" on "public"."profiles";

drop policy "Enable update for authenticated users based on user_id" on "public"."profiles";

create policy "Enable users to view their own data only" on "public"."profiles" as permissive for
select
  to authenticated using (
    (
      (
        SELECT
          auth.uid () AS uid
      ) = id
    )
  );
