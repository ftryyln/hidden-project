"""
Discord Bot for Guild Manager Attendance System
"""
import discord
from discord import app_commands
from discord.ext import commands
import aiohttp
import asyncio
from datetime import datetime
from config import Config

# Validate configuration
Config.validate()

# Bot setup
intents = discord.Intents.default()
intents.message_content = True
intents.members = True

bot = commands.Bot(command_prefix='!', intents=intents)


class AttendanceAPI:
    """API client for Guild Manager attendance endpoints"""
    
    def __init__(self):
        self.base_url = Config.GUILD_API_URL
        self.headers = {
            'Authorization': f'Bearer {Config.SUPABASE_SERVICE_ROLE_KEY}',
            'Content-Type': 'application/json'
        }
    
    async def find_member_by_discord_username(self, username: str):
        """Find member by Discord username"""
        async with aiohttp.ClientSession() as session:
            url = f"{self.base_url}/members/by-discord/{username}"
            async with session.get(url, headers=self.headers) as response:
                if response.status == 200:
                    return await response.json()
                elif response.status == 404:
                    return None
                else:
                    raise Exception(f"API Error: {response.status}")
    
    async def create_attendance_with_member(self, guild_id: str, session_name: str, member_id: str, user_id: str):
        """Create attendance session with member entry"""
        async with aiohttp.ClientSession() as session:
            url = f"{self.base_url}/guilds/{guild_id}/attendance"
            
            # Determine if it's a boss or map
            is_map = session_name.lower().startswith('map:')
            
            payload = {
                'bossName': None if is_map else session_name,
                'mapName': session_name[4:].strip() if is_map else None,
                'startedAt': datetime.utcnow().isoformat() + 'Z',
                'attendees': [
                    {
                        'memberId': member_id,
                        'note': None,
                        'lootTag': None
                    }
                ]
            }
            
            async with session.post(url, headers=self.headers, json=payload) as response:
                if response.status in [200, 201]:
                    result = await response.json()
                    return result.get('data')
                else:
                    error_text = await response.text()
                    raise Exception(f"Failed to create attendance: {response.status} - {error_text}")
    
    async def get_pending_attendance(self, guild_id: str):
        """Get pending attendance entries"""
        async with aiohttp.ClientSession() as session:
            url = f"{self.base_url}/guilds/{guild_id}/attendance/pending"
            async with session.get(url, headers=self.headers) as response:
                if response.status == 200:
                    return await response.json()
                else:
                    return []


# Initialize API client
api = AttendanceAPI()


@bot.event
async def on_ready():
    """Bot ready event"""
    print(f'✅ Bot logged in as {bot.user}')
    print(f'📊 Connected to {len(bot.guilds)} guild(s)')
    
    # Sync slash commands
    try:
        synced = await bot.tree.sync()
        print(f'✅ Synced {len(synced)} command(s)')
    except Exception as e:
        print(f'❌ Failed to sync commands: {e}')
    
    # Start reminder scheduler
    from scheduler import start_reminder_scheduler
    start_reminder_scheduler(bot, api)
    print('✅ Reminder scheduler started')


@bot.tree.command(name="attendance", description="Submit attendance untuk session")
@app_commands.describe(session_name="Nama boss atau map (gunakan 'map:' prefix untuk map, contoh: map:Vanaheim)")
async def attendance_command(interaction: discord.Interaction, session_name: str):
    """Slash command untuk submit attendance"""
    
    # Defer response karena API call bisa lama
    await interaction.response.defer(ephemeral=True)
    
    try:
        # Get Discord username (tanpa discriminator)
        discord_username = interaction.user.name
        
        # Find member by Discord username
        member = await api.find_member_by_discord_username(discord_username)
        
        if not member:
            await interaction.followup.send(
                f"❌ Member dengan Discord username `{discord_username}` tidak ditemukan.\n"
                f"Pastikan Discord username Anda sudah terdaftar di website Guild Manager.",
                ephemeral=True
            )
            return
        
        # Create attendance with member entry
        result = await api.create_attendance_with_member(
            guild_id=Config.DEFAULT_GUILD_ID,
            session_name=session_name,
            member_id=member['id'],
            user_id=member.get('user_id') or member['id']
        )
        
        # Extract session info from result
        session_info = result.get('session', {})
        session_display_name = session_info.get('bossName') or session_info.get('mapName') or session_name
        
        # Send confirmation to user
        await interaction.followup.send(
            f"✅ Attendance tercatat untuk **{session_display_name}**!\n"
            f"Status: ⏳ Pending confirmation\n"
            f"Member: {member['inGameName']}",
            ephemeral=True
        )
        
        # Send notification to bot-command channel
        if Config.BOT_COMMAND_CHANNEL_ID:
            channel = bot.get_channel(Config.BOT_COMMAND_CHANNEL_ID)
            if channel:
                embed = discord.Embed(
                    title="📋 New Attendance Entry",
                    description=f"**Session:** {session_display_name}",
                    color=discord.Color.blue(),
                    timestamp=datetime.utcnow()
                )
                embed.add_field(name="Member", value=member['inGameName'], inline=True)
                embed.add_field(name="Discord", value=f"@{discord_username}", inline=True)
                embed.add_field(name="Status", value="⏳ Pending Confirmation", inline=False)
                embed.set_footer(text=f"Session ID: {session_info.get('id', 'N/A')}")
                
                await channel.send(embed=embed)
    
    except Exception as e:
        print(f"❌ Error in attendance command: {e}")
        await interaction.followup.send(
            f"❌ Terjadi error saat mencatat attendance: {str(e)}",
            ephemeral=True
        )



@bot.tree.command(name="attendance-status", description="Cek status attendance pending")
@app_commands.checks.has_permissions(administrator=True)
async def attendance_status_command(interaction: discord.Interaction):
    """Slash command untuk cek pending attendance (admin only)"""
    
    await interaction.response.defer(ephemeral=True)
    
    try:
        pending = await api.get_pending_attendance(Config.DEFAULT_GUILD_ID)
        
        if not pending:
            await interaction.followup.send("✅ Tidak ada attendance yang pending!", ephemeral=True)
            return
        
        # Group by session
        sessions = {}
        for entry in pending:
            session_id = entry['session_id']
            if session_id not in sessions:
                sessions[session_id] = {
                    'name': entry.get('session_name', 'Unknown'),
                    'entries': []
                }
            sessions[session_id]['entries'].append(entry)
        
        # Create embed
        embed = discord.Embed(
            title="⏳ Pending Attendance",
            description=f"Total: {len(pending)} entries",
            color=discord.Color.orange(),
            timestamp=datetime.utcnow()
        )
        
        for session_id, data in sessions.items():
            members = [e.get('member_name', 'Unknown') for e in data['entries']]
            embed.add_field(
                name=f"📍 {data['name']}",
                value=f"{len(members)} members: {', '.join(members[:5])}{'...' if len(members) > 5 else ''}",
                inline=False
            )
        
        await interaction.followup.send(embed=embed, ephemeral=True)
    
    except Exception as e:
        print(f"❌ Error in status command: {e}")
        await interaction.followup.send(f"❌ Error: {str(e)}", ephemeral=True)


def main():
    """Main entry point"""
    print("🚀 Starting Discord Attendance Bot...")
    print(f"📡 API URL: {Config.GUILD_API_URL}")
    print(f"🏰 Default Guild ID: {Config.DEFAULT_GUILD_ID}")
    
    bot.run(Config.DISCORD_BOT_TOKEN)


if __name__ == "__main__":
    main()
