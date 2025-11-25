# Discord Attendance Bot

Bot Discord untuk sistem attendance Guild Manager yang terintegrasi dengan website.

## Prerequisites

- Python 3.9+
- Discord Bot Token
- Guild Manager API running
- Supabase service role key

## Setup

1. Install dependencies:
```bash
pip install -r requirements.txt
```

2. Copy `.env.example` to `.env` dan isi dengan credentials:
```bash
cp .env.example .env
```

3. Konfigurasi `.env`:
   - `DISCORD_BOT_TOKEN`: Token dari Discord Developer Portal
   - `GUILD_API_URL`: URL API Guild Manager (default: http://localhost:8080/api/v1)
   - `SUPABASE_SERVICE_ROLE_KEY`: Service role key dari Supabase
   - `DEFAULT_GUILD_ID`: UUID guild default
   - `BOT_COMMAND_CHANNEL_ID`: ID channel bot-command
   - `YMIR_LEAD_ROLE_ID`: ID role Ymir Lead

## Running the Bot

```bash
python bot.py
```

## Features

### Slash Commands

#### `/attendance`
Submit attendance untuk session tertentu.

**Parameters:**
- `session_name` (required): Nama boss atau map untuk session attendance

**Behavior:**
1. Bot akan mencari member berdasarkan Discord username Anda
2. Jika member tidak ditemukan, akan menampilkan error
3. Jika ditemukan, akan mencatat attendance dengan status pending
4. Mengirim konfirmasi ke channel `bot-command`
5. Memberikan konfirmasi private ke user

### Background Tasks

#### Daily Reminder
Bot akan mengirim reminder setiap hari jam 09:00 WIB jika ada attendance yang belum dikonfirmasi lebih dari 24 jam.

Reminder akan mention role `Ymir Lead` di channel `bot-command`.

## Discord Bot Setup

1. Buat bot di [Discord Developer Portal](https://discord.com/developers/applications)
2. Enable "Message Content Intent" di Bot settings
3. Enable "Server Members Intent" di Bot settings
4. Invite bot ke server dengan permissions:
   - Send Messages
   - Use Slash Commands
   - Mention Everyone (untuk mention role)
   - Read Message History

## Troubleshooting

### Bot tidak merespon slash command
- Pastikan bot sudah invite dengan permission yang benar
- Pastikan slash command sudah sync (tunggu beberapa menit setelah bot start)

### Member tidak ditemukan
- Pastikan member sudah terdaftar di website
- Pastikan Discord username di website sama dengan username Discord (tanpa discriminator)
- Format: `username` bukan `username#1234`

### Reminder tidak jalan
- Pastikan timezone sudah benar di `.env`
- Check log untuk error
- Pastikan bot running 24/7 (gunakan service manager atau hosting)
