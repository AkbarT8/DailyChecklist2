/*
  # Make user-requests storage bucket public

  Excel files uploaded by users for processing need to be downloadable
  by the admin via a permanent link sent through WhatsApp.
  Making the bucket public gives us stable, permanent URLs with no expiry.
*/

UPDATE storage.buckets
SET public = true
WHERE id = 'user-requests';
