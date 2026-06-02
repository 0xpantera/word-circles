use super::models::{
    DailyResult, GamePlayerRecord, GameRecord, GuessRecord, LeaderboardEntry, PlayerRecord,
};
use std::fmt;
use std::future::Future;

#[derive(Debug)]
pub enum RepositoryError {
    NotFound,
    Conflict(String),
    Internal(String),
}

impl fmt::Display for RepositoryError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::NotFound => write!(f, "not found"),
            Self::Conflict(msg) => write!(f, "conflict: {msg}"),
            Self::Internal(msg) => write!(f, "internal error: {msg}"),
        }
    }
}

impl std::error::Error for RepositoryError {}

pub trait GameRepository: Send + Sync + 'static {
    fn create_game(
        &self,
        game: &GameRecord,
    ) -> impl Future<Output = Result<(), RepositoryError>> + Send;

    fn get_game(
        &self,
        game_id: &str,
    ) -> impl Future<Output = Result<Option<GameRecord>, RepositoryError>> + Send;

    fn update_game_status(
        &self,
        game_id: &str,
        status: &str,
    ) -> impl Future<Output = Result<(), RepositoryError>> + Send;

    fn get_or_create_player(
        &self,
        address: &str,
    ) -> impl Future<Output = Result<PlayerRecord, RepositoryError>> + Send;

    fn record_guess(
        &self,
        guess: &GuessRecord,
    ) -> impl Future<Output = Result<(), RepositoryError>> + Send;

    fn get_guesses(
        &self,
        game_id: &str,
        player_id: i64,
    ) -> impl Future<Output = Result<Vec<GuessRecord>, RepositoryError>> + Send;

    fn get_guess_count(
        &self,
        game_id: &str,
        player_id: i64,
    ) -> impl Future<Output = Result<u32, RepositoryError>> + Send;

    fn get_leaderboard(
        &self,
        limit: u32,
        offset: u32,
    ) -> impl Future<Output = Result<Vec<LeaderboardEntry>, RepositoryError>> + Send;

    fn get_daily_results(
        &self,
        game_id: &str,
    ) -> impl Future<Output = Result<Vec<DailyResult>, RepositoryError>> + Send;

    fn get_indexer_cursor(&self) -> impl Future<Output = Result<u64, RepositoryError>> + Send;

    fn set_indexer_cursor(
        &self,
        block_number: u64,
    ) -> impl Future<Output = Result<(), RepositoryError>> + Send;

    fn add_game_player(
        &self,
        game_id: &str,
        player_id: i64,
        address: &str,
    ) -> impl Future<Output = Result<(), RepositoryError>> + Send;

    fn get_game_players(
        &self,
        game_id: &str,
    ) -> impl Future<Output = Result<Vec<GamePlayerRecord>, RepositoryError>> + Send;

    fn update_game_player_started(
        &self,
        game_id: &str,
        player_id: i64,
    ) -> impl Future<Output = Result<(), RepositoryError>> + Send;

    fn update_game_player_finished(
        &self,
        game_id: &str,
        player_id: i64,
        solved: bool,
        guess_count: u32,
    ) -> impl Future<Output = Result<(), RepositoryError>> + Send;

    fn update_game_pvp_fields(
        &self,
        game_id: &str,
        word_index: usize,
        salt: &str,
        commitment: &str,
        status: &str,
    ) -> impl Future<Output = Result<(), RepositoryError>> + Send;

    fn get_active_pvp_games(
        &self,
    ) -> impl Future<Output = Result<Vec<GameRecord>, RepositoryError>> + Send;

    /// PvP games a player has joined, most recent first. When `active_only`,
    /// limits to games still in progress (`waiting`/`active`) — used by the
    /// lobby to discover the on-chain gameId assigned after `join`.
    fn get_games_by_player(
        &self,
        address: &str,
        active_only: bool,
    ) -> impl Future<Output = Result<Vec<GameRecord>, RepositoryError>> + Send;

    /// PvP games in a given status — used by the bot to find lobbies to fill
    /// (`waiting`) and games it should play (`active`).
    fn get_pvp_games_by_status(
        &self,
        status: &str,
    ) -> impl Future<Output = Result<Vec<GameRecord>, RepositoryError>> + Send;

    /// Append a telemetry event. `wallet` is a hex address string, `kind` is a
    /// short label like "miniapp_open". Used to measure weekly active wallets.
    ///
    /// When `referrer` is `Some`, the event is written together with a guarded
    /// referral attribution in a single transaction (Criterion 4): the invitee
    /// is credited to the referrer iff this is the invitee's very first event
    /// (never seen as event/player/referral) and the referrer is a known wallet.
    /// The attribution insert runs before the event insert so the "no prior
    /// events" guard sees the pre-insert state.
    fn record_event(
        &self,
        wallet: &str,
        kind: &str,
        referrer: Option<&str>,
    ) -> impl Future<Output = Result<(), RepositoryError>> + Send;

    /// Number of invitees attributed to `referrer` (hex address). Lifetime count;
    /// `referrals.created_at` allows cycle-scoping later if needed.
    fn count_referrals(
        &self,
        referrer: &str,
    ) -> impl Future<Output = Result<u64, RepositoryError>> + Send;
}
