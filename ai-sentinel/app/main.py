import sys

def main():
    print("AI Sentinel Started")
    try:
        import metagpt
        print(f"MetaGPT version: {metagpt.__version__}")
    except ImportError:
        print("MetaGPT not installed")

    try:
        import autogen
        print(f"AutoGen version: {autogen.__version__}")
    except ImportError:
        print("AutoGen not installed")

if __name__ == "__main__":
    main()
