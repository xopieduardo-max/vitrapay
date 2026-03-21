
-- Delete all fake sales
DELETE FROM sales WHERE payment_id LIKE 'fake_%';

-- Delete profiles and roles for test users (keeping ab4f9f40, 31d372d2, 6b935de0)
DELETE FROM user_roles WHERE user_id IN ('13e17daa-ed6a-4508-844f-81728e649ac4', '65d03944-c4e9-48c6-a73b-5c1947c7aa0d', 'e993bfd1-3253-4983-8471-f652ca2d7e92', '7c83f2e0-9371-427e-bf1b-d0ede0cf194e');
DELETE FROM profiles WHERE user_id IN ('13e17daa-ed6a-4508-844f-81728e649ac4', '65d03944-c4e9-48c6-a73b-5c1947c7aa0d', 'e993bfd1-3253-4983-8471-f652ca2d7e92', '7c83f2e0-9371-427e-bf1b-d0ede0cf194e');
