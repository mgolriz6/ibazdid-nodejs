-- phpMyAdmin SQL Dump
-- version 4.8.1
-- https://www.phpmyadmin.net/
--
-- Host: localhost
-- Generation Time: Jul 01, 2018 at 04:31 PM
-- Server version: 10.1.29-MariaDB-6
-- PHP Version: 7.2.7-1+ubuntu18.04.1+deb.sury.org+1

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
SET AUTOCOMMIT = 0;
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `ibazdid`
--

-- --------------------------------------------------------

--
-- Table structure for table `ibazdid_ads`
--

CREATE TABLE `ibazdid_ads` (
  `chat_id` int(15) NOT NULL,
  `message_id` int(15) NOT NULL,
  `reply_id` int(15) NOT NULL,
  `tracking_id` int(255) NOT NULL,
  `time` int(15) NOT NULL,
  `credit` mediumint(8) NOT NULL,
  `seens` mediumint(8) NOT NULL DEFAULT '0',
  `completed` tinyint(1) NOT NULL DEFAULT '0'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_persian_ci;

-- --------------------------------------------------------

--
-- Table structure for table `ibazdid_messages`
--

CREATE TABLE `ibazdid_messages` (
  `id` int(15) NOT NULL,
  `chat_id` int(15) NOT NULL,
  `date` int(15) NOT NULL,
  `message` text COLLATE utf8mb4_persian_ci NOT NULL,
  `reply` text COLLATE utf8mb4_persian_ci,
  `seen` tinyint(1) NOT NULL DEFAULT '0'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_persian_ci;

-- --------------------------------------------------------

--
-- Table structure for table `ibazdid_pendings`
--

CREATE TABLE `ibazdid_pendings` (
  `id` int(15) NOT NULL,
  `chat_id` int(15) NOT NULL,
  `message_id` int(15) DEFAULT NULL,
  `credit` int(15) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_persian_ci;

-- --------------------------------------------------------

--
-- Table structure for table `ibazdid_reports`
--

CREATE TABLE `ibazdid_reports` (
  `id` int(15) NOT NULL,
  `chat_id` int(15) NOT NULL,
  `ad_id` int(15) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_persian_ci;

-- --------------------------------------------------------

--
-- Table structure for table `ibazdid_seens`
--

CREATE TABLE `ibazdid_seens` (
  `id` int(15) NOT NULL,
  `chat_id` int(15) NOT NULL,
  `ad_id` int(15) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_persian_ci;

-- --------------------------------------------------------

--
-- Table structure for table `ibazdid_transactions`
--

CREATE TABLE `ibazdid_transactions` (
  `id` int(11) NOT NULL,
  `transaction_id` int(15) NOT NULL,
  `date` int(15) NOT NULL,
  `amount` int(11) NOT NULL,
  `sender` int(15) NOT NULL,
  `receiver` int(15) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_persian_ci;

-- --------------------------------------------------------

--
-- Table structure for table `ibazdid_users`
--

CREATE TABLE `ibazdid_users` (
  `chat_id` int(25) NOT NULL,
  `registration_date` int(25) NOT NULL,
  `panel` tinyint(4) NOT NULL DEFAULT '0',
  `credit` float NOT NULL DEFAULT '50',
  `ads` smallint(11) NOT NULL DEFAULT '0',
  `earned_credit` float NOT NULL DEFAULT '0',
  `used_credit` mediumint(8) NOT NULL DEFAULT '0',
  `received_credit` mediumint(8) NOT NULL DEFAULT '0',
  `transferred_credit` mediumint(8) NOT NULL DEFAULT '0',
  `gifted_credit` mediumint(8) NOT NULL DEFAULT '0',
  `referrer` int(25) DEFAULT NULL,
  `referrals_count` smallint(5) NOT NULL DEFAULT '0',
  `active_referrals` int(15) DEFAULT '0',
  `referrals_visits` int(255) NOT NULL DEFAULT '0',
  `commission` float NOT NULL DEFAULT '0',
  `nitro` int(15) NOT NULL DEFAULT '0',
  `last_visit` varchar(20) COLLATE utf8mb4_persian_ci DEFAULT NULL,
  `today_visits` smallint(5) NOT NULL DEFAULT '0',
  `yesterday_visits` smallint(5) NOT NULL DEFAULT '0',
  `day3_visits` smallint(5) NOT NULL DEFAULT '0',
  `day4_visits` smallint(5) NOT NULL DEFAULT '0',
  `day5_visits` smallint(5) NOT NULL DEFAULT '0',
  `day6_visits` smallint(5) NOT NULL DEFAULT '0',
  `day7_visits` smallint(5) NOT NULL DEFAULT '0',
  `shop_credit` int(11) NOT NULL DEFAULT '0',
  `vip_panel` int(15) NOT NULL DEFAULT '0',
  `vip_time` int(15) NOT NULL DEFAULT '0',
  `status` varchar(255) COLLATE utf8mb4_persian_ci DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_persian_ci;

--
-- Indexes for dumped tables
--

--
-- Indexes for table `ibazdid_ads`
--
ALTER TABLE `ibazdid_ads`
  ADD PRIMARY KEY (`message_id`);

--
-- Indexes for table `ibazdid_messages`
--
ALTER TABLE `ibazdid_messages`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `ibazdid_pendings`
--
ALTER TABLE `ibazdid_pendings`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `ibazdid_reports`
--
ALTER TABLE `ibazdid_reports`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `ibazdid_seens`
--
ALTER TABLE `ibazdid_seens`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `ibazdid_transactions`
--
ALTER TABLE `ibazdid_transactions`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `ibazdid_users`
--
ALTER TABLE `ibazdid_users`
  ADD PRIMARY KEY (`chat_id`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `ibazdid_messages`
--
ALTER TABLE `ibazdid_messages`
  MODIFY `id` int(15) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `ibazdid_pendings`
--
ALTER TABLE `ibazdid_pendings`
  MODIFY `id` int(15) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `ibazdid_reports`
--
ALTER TABLE `ibazdid_reports`
  MODIFY `id` int(15) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `ibazdid_seens`
--
ALTER TABLE `ibazdid_seens`
  MODIFY `id` int(15) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `ibazdid_transactions`
--
ALTER TABLE `ibazdid_transactions`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
