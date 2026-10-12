-- Le seed de démo (restaurant + 6 remises scellées, dont 1 en litige) a besoin de calculer
-- des empreintes SHA-256 sur des photos et de les déposer dans Storage : il est donc écrit en
-- TypeScript et partage exactement le code du scellé de l'application.
--
--   npm run seed      (voir scripts/seed.ts et le README)
--
-- Ce fichier reste volontairement vide de données pour que `supabase db reset` fonctionne
-- sans dépendance au stockage.
select 1;
