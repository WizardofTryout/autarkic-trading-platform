import asyncio
from sqlalchemy import text
from app.db.session import async_session
from app.models.base import UserDocument

async def check_schema():
    async with async_session() as session:
        try:
            # Check if column exists in user_documents table
            result = await session.execute(text(
                "SELECT column_name FROM information_schema.columns WHERE table_name = 'user_documents' AND column_name = 'folder';"
            ))
            column = result.scalar()
            if column:
                print("SUCCESS: Column 'folder' exists in 'user_documents'.")
            else:
                print("FAILURE: Column 'folder' DOES NOT exist in 'user_documents'.")
                
            # Also list all columns for debugging
            result_all = await session.execute(text(
                "SELECT column_name FROM information_schema.columns WHERE table_name = 'user_documents';"
            ))
            columns = [row[0] for row in result_all.fetchall()]
            print(f"All columns: {columns}")
            
        except Exception as e:
            print(f"Error checking schema: {e}")

if __name__ == "__main__":
    asyncio.run(check_schema())
