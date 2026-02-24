CREATE INDEX IF NOT EXISTS idx_bot_sessions_chat_id ON bot_sessions(chat_id);
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_alerts_project_id ON alerts(project_id);