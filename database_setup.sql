-- Mind Freek Database Schema
-- Create this database and tables for the application to work

CREATE DATABASE IF NOT EXISTS mindfreek;
USE mindfreek;

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id INT PRIMARY KEY AUTO_INCREMENT,
  username VARCHAR(50) NOT NULL UNIQUE,
  language VARCHAR(20),
  country VARCHAR(50),
  status ENUM('online', 'rooms', 'playing') DEFAULT 'online',
  profile LONGTEXT,
  socket_id VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_status (status),
  INDEX idx_country (country),
  INDEX idx_socket_id (socket_id)
);

-- Rooms table
CREATE TABLE IF NOT EXISTS rooms (
  room_id INT PRIMARY KEY AUTO_INCREMENT,
  room_key VARCHAR(255) UNIQUE,
  player VARCHAR(500),
  max_players INT DEFAULT 3,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  game_status ENUM('waiting', 'playing', 'finished') DEFAULT 'waiting',
  current_turn_user INT,
  current_word VARCHAR(100),
  current_round INT DEFAULT 1,
  total_rounds INT DEFAULT 3,
  round_start_time TIMESTAMP NULL,
  round_end_time TIMESTAMP NULL,
  INDEX idx_room_key (room_key),
  INDEX idx_game_status (game_status),
  FOREIGN KEY (current_turn_user) REFERENCES users(id) ON DELETE SET NULL
);

-- Room players table
CREATE TABLE IF NOT EXISTS room_players (
  id INT PRIMARY KEY AUTO_INCREMENT,
  room_id INT NOT NULL,
  user_id INT NOT NULL,
  score INT DEFAULT 0,
  is_drawer TINYINT DEFAULT 0,
  joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_room_player (room_id, user_id),
  FOREIGN KEY (room_id) REFERENCES rooms(room_id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_room_id (room_id),
  INDEX idx_user_id (user_id)
);

-- Rounds table
CREATE TABLE IF NOT EXISTS rounds (
  id INT PRIMARY KEY AUTO_INCREMENT,
  room_id INT NOT NULL,
  round_no INT,
  drawer_user_id INT,
  word VARCHAR(100),
  started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  ended_at TIMESTAMP NULL,
  FOREIGN KEY (room_id) REFERENCES rooms(room_id) ON DELETE CASCADE,
  FOREIGN KEY (drawer_user_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_room_id (room_id),
  INDEX idx_round_no (round_no)
);

-- Guesses table
CREATE TABLE IF NOT EXISTS guesses (
  id INT PRIMARY KEY AUTO_INCREMENT,
  room_id INT NOT NULL,
  round_id INT,
  user_id INT,
  guess_text VARCHAR(100),
  is_correct TINYINT DEFAULT 0,
  guessed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (room_id) REFERENCES rooms(room_id) ON DELETE CASCADE,
  FOREIGN KEY (round_id) REFERENCES rounds(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_room_id (room_id),
  INDEX idx_user_id (user_id),
  INDEX idx_is_correct (is_correct)
);

-- Performance indexes
ALTER TABLE users ADD INDEX idx_created_at (created_at);
ALTER TABLE rooms ADD INDEX idx_created_at (created_at);
ALTER TABLE room_players ADD INDEX idx_joined_at (joined_at);
ALTER TABLE guesses ADD INDEX idx_guessed_at (guessed_at);

-- Initial data (optional)
-- You can add sample data here for testing

COMMIT;

-- Run this SQL script in MySQL:
-- mysql -u root -p < database_setup.sql
-- Or:
-- mysql -h localhost -u root -p mindfreek < database_setup.sql
