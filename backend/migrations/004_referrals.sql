-- Hackathon Criterion 4: invite-driven new wallets per cycle.
-- One row per invitee (PRIMARY KEY) so attribution is idempotent: the first
-- successful insert wins; later attempts no-op via ON CONFLICT.
CREATE TABLE referrals (
    invitee    BYTEA PRIMARY KEY,
    referrer   BYTEA NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_referrals_referrer ON referrals(referrer);
