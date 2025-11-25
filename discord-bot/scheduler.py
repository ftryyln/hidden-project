"""
Background scheduler for attendance reminders
"""
import discord
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from datetime import datetime, timedelta
import pytz
from config import Config


async def send_attendance_reminder(bot, api):
    """Send reminder for pending attendance entries"""
    try:
        print(f"🔔 Running attendance reminder check at {datetime.now()}")
        
        # Get pending attendance
        pending = await api.get_pending_attendance(Config.DEFAULT_GUILD_ID)
        
        if not pending:
            print("✅ No pending attendance entries")
            return
        
        # Filter entries older than 24 hours
        now = datetime.utcnow()
        old_pending = []
        
        for entry in pending:
            created_at = datetime.fromisoformat(entry['created_at'].replace('Z', '+00:00'))
            if (now - created_at.replace(tzinfo=None)) > timedelta(hours=24):
                old_pending.append(entry)
        
        if not old_pending:
            print(f"✅ {len(pending)} pending entries, but all are < 24 hours old")
            return
        
        # Group by session
        sessions = {}
        for entry in old_pending:
            session_id = entry['session_id']
            if session_id not in sessions:
                sessions[session_id] = {
                    'name': entry.get('session_name', 'Unknown'),
                    'date': entry.get('started_at', ''),
                    'entries': []
                }
            sessions[session_id]['entries'].append(entry)
        
        # Send reminder to bot-command channel
        if Config.BOT_COMMAND_CHANNEL_ID:
            channel = bot.get_channel(Config.BOT_COMMAND_CHANNEL_ID)
            if not channel:
                print(f"❌ Channel {Config.BOT_COMMAND_CHANNEL_ID} not found")
                return
            
            # Create embed
            embed = discord.Embed(
                title="⚠️ Attendance Reminder",
                description=f"Ada **{len(old_pending)}** attendance yang belum dikonfirmasi lebih dari 24 jam!",
                color=discord.Color.red(),
                timestamp=datetime.utcnow()
            )
            
            for session_id, data in sessions.items():
                members = [e.get('member_name', 'Unknown') for e in data['entries']]
                session_date = data['date'][:10] if data['date'] else 'Unknown'
                
                embed.add_field(
                    name=f"📍 {data['name']} ({session_date})",
                    value=f"**{len(members)} members:** {', '.join(members[:10])}{'...' if len(members) > 10 else ''}",
                    inline=False
                )
            
            embed.set_footer(text="Silakan konfirmasi attendance melalui web dashboard")
            
            # Mention Ymir Lead role if configured
            mention_text = ""
            if Config.YMIR_LEAD_ROLE_ID:
                mention_text = f"<@&{Config.YMIR_LEAD_ROLE_ID}> "
            
            await channel.send(
                content=f"{mention_text}⚠️ **Reminder: Pending Attendance Confirmation**",
                embed=embed
            )
            
            print(f"✅ Sent reminder for {len(old_pending)} pending entries")
        else:
            print("⚠️  BOT_COMMAND_CHANNEL_ID not configured, skipping reminder")
    
    except Exception as e:
        print(f"❌ Error in attendance reminder: {e}")
        import traceback
        traceback.print_exc()


def start_reminder_scheduler(bot, api):
    """Start the background scheduler for reminders"""
    scheduler = AsyncIOScheduler()
    
    # Parse reminder time
    hour, minute = map(int, Config.REMINDER_TIME.split(':'))
    
    # Get timezone
    try:
        tz = pytz.timezone(Config.REMINDER_TIMEZONE)
    except:
        print(f"⚠️  Invalid timezone {Config.REMINDER_TIMEZONE}, using UTC")
        tz = pytz.UTC
    
    # Schedule daily reminder
    scheduler.add_job(
        send_attendance_reminder,
        trigger=CronTrigger(hour=hour, minute=minute, timezone=tz),
        args=[bot, api],
        id='attendance_reminder',
        name='Daily Attendance Reminder',
        replace_existing=True
    )
    
    # Also add a job to run 5 minutes after bot starts (for testing)
    scheduler.add_job(
        send_attendance_reminder,
        'date',
        run_date=datetime.now() + timedelta(minutes=5),
        args=[bot, api],
        id='attendance_reminder_startup',
        name='Startup Attendance Reminder (Test)'
    )
    
    scheduler.start()
    
    print(f"⏰ Scheduled daily reminder at {Config.REMINDER_TIME} {Config.REMINDER_TIMEZONE}")
    print(f"⏰ Test reminder will run in 5 minutes")
    
    return scheduler
