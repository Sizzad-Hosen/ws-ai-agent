-- The access token, encrypted rather than pointed at.
--
-- `token_reference` was named for an indirection this deployment does not have:
-- the secret provider returns null in production, so a pointer would resolve to
-- nothing. The column now holds an AES-256-GCM envelope, and the name says so.
--
-- A column called `*_reference` that contains a secret is the kind of thing
-- somebody later logs on the assumption it is only an identifier.
ALTER TABLE "whatsapp_accounts"
    RENAME COLUMN "token_reference" TO "access_token_encrypted";
