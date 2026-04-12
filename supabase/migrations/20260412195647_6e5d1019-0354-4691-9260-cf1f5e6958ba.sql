
UPDATE products SET is_published = false, allow_affiliates = false
WHERE id IN (
  '87f3ee84-aa7b-4a66-babb-436e9f6bbfca',
  '6d19a8f3-6275-410e-ad86-3b89c9a4e58a'
);

UPDATE platform_banners SET location = 'both' WHERE id = 'eb216c13-52de-48de-bc16-fce975db13f5';
