-- Extensions (hapus "http" jika tidak dipakai/izin kurang)
create extension if not exists "uuid-ossp";

create extension if not exists "pgcrypto";

create extension if not exists "http";

-- Enums
create type public.tx_type as enum ('income', 'expense', 'transfer');

create type public.user_role as enum ('guild_admin', 'officer', 'member', 'viewer');

create type public.guild_role as enum ('leader', 'officer', 'raider', 'casual');

create type public.rarity as enum ('common', 'rare', 'epic', 'legendary', 'mythic');