-- SuiKa MySQL Schema
-- Run this once after creating your MySQL database on World4You
-- Compatible with MySQL 5.7+ and 8.0+

SET NAMES utf8mb4;
SET time_zone = '+00:00';

CREATE TABLE IF NOT EXISTS `users` (
  `id`                    VARCHAR(36)  NOT NULL,
  `username`              VARCHAR(100) NOT NULL,
  `password`              VARCHAR(255) NOT NULL,
  `display_name`          VARCHAR(100) DEFAULT NULL,
  `default_lat`           DOUBLE       DEFAULT NULL,
  `default_lon`           DOUBLE       DEFAULT NULL,
  `default_location_name` VARCHAR(200) DEFAULT NULL,
  `created_at`            DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `users_username_unique` (`username`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `health_logs` (
  `id`                  VARCHAR(36) NOT NULL,
  `user_id`             VARCHAR(36) NOT NULL,
  `date`                DATE        NOT NULL,
  `physical_pain`       TINYINT     NOT NULL DEFAULT 1,
  `mental_pain`         TINYINT     NOT NULL DEFAULT 1,
  `soul_state`          TINYINT     DEFAULT NULL,
  `shutdown_meltdown`   VARCHAR(50) DEFAULT NULL,
  `body_entries`        JSON        DEFAULT NULL,
  `stress_entries`      JSON        DEFAULT NULL,
  `regulation_entries`  JSON        DEFAULT NULL,
  `notes`               TEXT        DEFAULT NULL,
  `created_at`          DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `health_logs_user_date` (`user_id`, `date`),
  CONSTRAINT `fk_health_logs_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `timer_sessions` (
  `id`                    VARCHAR(36)  NOT NULL,
  `user_id`               VARCHAR(36)  NOT NULL,
  `preset_id`             VARCHAR(36)  DEFAULT NULL,
  `category_id`           VARCHAR(100) NOT NULL,
  `category_name`         VARCHAR(100) NOT NULL,
  `category_color`        VARCHAR(20)  NOT NULL,
  `duration`              INT          NOT NULL,
  `completed_at`          DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `mode`                  VARCHAR(50)  NOT NULL,
  `connection_reflection` TEXT         DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_timer_sessions_user` (`user_id`),
  CONSTRAINT `fk_timer_sessions_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `presets` (
  `id`          VARCHAR(36)  NOT NULL,
  `user_id`     VARCHAR(36)  NOT NULL,
  `name`        VARCHAR(100) NOT NULL,
  `duration`    INT          NOT NULL,
  `category_id` VARCHAR(100) NOT NULL,
  `created_at`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_presets_user` (`user_id`),
  CONSTRAINT `fk_presets_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `custom_categories` (
  `id`         VARCHAR(36) NOT NULL,
  `user_id`    VARCHAR(36) NOT NULL,
  `name`       VARCHAR(100) NOT NULL,
  `color`      VARCHAR(20)  NOT NULL,
  `created_at` DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_custom_categories_user` (`user_id`),
  CONSTRAINT `fk_custom_categories_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `stress_factors` (
  `id`         VARCHAR(36)  NOT NULL,
  `user_id`    VARCHAR(36)  NOT NULL,
  `label`      VARCHAR(200) NOT NULL,
  `category`   VARCHAR(100) NOT NULL,
  `sort_order` INT          NOT NULL DEFAULT 0,
  `is_default` TINYINT(1)   NOT NULL DEFAULT 0,
  `created_at` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_stress_factors_user` (`user_id`),
  CONSTRAINT `fk_stress_factors_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `regulation_strategies` (
  `id`         VARCHAR(36)  NOT NULL,
  `user_id`    VARCHAR(36)  NOT NULL,
  `label`      VARCHAR(200) NOT NULL,
  `channel`    VARCHAR(100) NOT NULL,
  `sort_order` INT          NOT NULL DEFAULT 0,
  `is_default` TINYINT(1)   NOT NULL DEFAULT 0,
  `created_at` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_regulation_strategies_user` (`user_id`),
  CONSTRAINT `fk_regulation_strategies_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `regulation_logs` (
  `id`                  VARCHAR(36) NOT NULL,
  `user_id`             VARCHAR(36) NOT NULL,
  `date`                DATE        NOT NULL,
  `active_strategy_ids` JSON        DEFAULT NULL,
  `updated_at`          DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `regulation_logs_user_date` (`user_id`, `date`),
  CONSTRAINT `fk_regulation_logs_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `environment_snapshots` (
  `id`               VARCHAR(36) NOT NULL,
  `user_id`          VARCHAR(36) NOT NULL,
  `date`             DATE        NOT NULL,
  `pollen_level`     VARCHAR(20) DEFAULT NULL,
  `aqi`              FLOAT       DEFAULT NULL,
  `pressure`         FLOAT       DEFAULT NULL,
  `daylight_minutes` INT         DEFAULT NULL,
  `feels_like_temp`  FLOAT       DEFAULT NULL,
  `humidity`         FLOAT       DEFAULT NULL,
  `created_at`       DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `environment_snapshots_user_date` (`user_id`, `date`),
  CONSTRAINT `fk_environment_snapshots_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
