-- Import only into the dedicated database devrijon_screenroom.
CREATE TABLE IF NOT EXISTS titles (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, slug VARCHAR(160) NOT NULL UNIQUE,
 kind ENUM('movie','series') NOT NULL,tmdb_id BIGINT UNSIGNED NULL,
 title VARCHAR(250) NOT NULL,synopsis TEXT NULL,release_year SMALLINT UNSIGNED NULL,
 genres JSON NULL,poster_url VARCHAR(1400) NULL,backdrop_url VARCHAR(1400) NULL,
 runtime_minutes SMALLINT UNSIGNED NULL,
 status ENUM('draft','published','archived') NOT NULL DEFAULT 'draft',
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 INDEX idx_status_kind(status,kind),INDEX idx_tmdb(kind,tmdb_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS seasons (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,title_id BIGINT UNSIGNED NOT NULL,
 season_number SMALLINT UNSIGNED NOT NULL,name VARCHAR(250) NOT NULL,synopsis TEXT NULL,
 UNIQUE KEY uniq_season(title_id,season_number),
 FOREIGN KEY(title_id) REFERENCES titles(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS episodes (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,season_id BIGINT UNSIGNED NOT NULL,
 episode_number SMALLINT UNSIGNED NOT NULL,title VARCHAR(250) NOT NULL,
 synopsis TEXT NULL,still_url VARCHAR(1400) NULL,runtime_minutes SMALLINT UNSIGNED NULL,
 UNIQUE KEY uniq_episode(season_id,episode_number),
 FOREIGN KEY(season_id) REFERENCES seasons(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS media_assets (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,title_id BIGINT UNSIGNED NULL,episode_id BIGINT UNSIGNED NULL,
 role ENUM('feature','episode','trailer') NOT NULL,format ENUM('mp4','hls','mkv','mka','m4v','webm','mov','avi','flv','ts','m2ts','mpg','mpeg','mp3','m4a','aac','flac','wav','ogg','ogv','opus','3gp') NOT NULL,
 provider ENUM('r2','internet_archive','wikimedia_commons','nasa_library','authorized_https') NOT NULL DEFAULT 'r2',
 r2_key VARCHAR(1000) NULL,source_url VARCHAR(2000) NULL,content_type VARCHAR(120) NULL,
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(title_id) REFERENCES titles(id) ON DELETE CASCADE,
 FOREIGN KEY(episode_id) REFERENCES episodes(id) ON DELETE CASCADE,
 INDEX idx_title_assets(title_id), INDEX idx_episode_assets(episode_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS admin_sessions (
 token_hash CHAR(64) PRIMARY KEY,csrf_hash CHAR(64) NOT NULL,expires_at DATETIME NOT NULL,
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,INDEX idx_expiry(expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
