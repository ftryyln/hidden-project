"""
Configuration management for Discord bot
"""
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

class Config:
    """Bot configuration from environment variables"""
    
    # Discord Configuration
    DISCORD_BOT_TOKEN = os.getenv('DISCORD_BOT_TOKEN')
    BOT_COMMAND_CHANNEL_ID = int(os.getenv('BOT_COMMAND_CHANNEL_ID', '0'))
    YMIR_LEAD_ROLE_ID = int(os.getenv('YMIR_LEAD_ROLE_ID', '0'))
    
    # API Configuration
    GUILD_API_URL = os.getenv('GUILD_API_URL', 'http://localhost:8080/api/v1')
    SUPABASE_SERVICE_ROLE_KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY')
    DEFAULT_GUILD_ID = os.getenv('DEFAULT_GUILD_ID')
    
    # Reminder Configuration
    REMINDER_TIME = os.getenv('REMINDER_TIME', '09:00')
    REMINDER_TIMEZONE = os.getenv('REMINDER_TIMEZONE', 'Asia/Jakarta')
    
    @classmethod
    def validate(cls):
        """Validate required configuration"""
        required = [
            ('DISCORD_BOT_TOKEN', cls.DISCORD_BOT_TOKEN),
            ('SUPABASE_SERVICE_ROLE_KEY', cls.SUPABASE_SERVICE_ROLE_KEY),
            ('DEFAULT_GUILD_ID', cls.DEFAULT_GUILD_ID),
        ]
        
        missing = [name for name, value in required if not value]
        
        if missing:
            raise ValueError(f"Missing required environment variables: {', '.join(missing)}")
        
        if cls.BOT_COMMAND_CHANNEL_ID == 0:
            print("⚠️  Warning: BOT_COMMAND_CHANNEL_ID not set, notifications will be disabled")
        
        if cls.YMIR_LEAD_ROLE_ID == 0:
            print("⚠️  Warning: YMIR_LEAD_ROLE_ID not set, reminders will not mention role")
        
        return True


# Required environment variables template (copy to .env):
"""
DISCORD_BOT_TOKEN=your_bot_token_here
GUILD_API_URL=http://localhost:8080/api/v1
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
DEFAULT_GUILD_ID=your_guild_uuid_here
BOT_COMMAND_CHANNEL_ID=123456789012345678
YMIR_LEAD_ROLE_ID=123456789012345678
REMINDER_TIME=09:00
REMINDER_TIMEZONE=Asia/Jakarta
"""
