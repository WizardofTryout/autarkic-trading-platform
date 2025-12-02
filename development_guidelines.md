# Development Guidelines & Rules

This document serves as the single source of truth for general development workflows, architectural decisions, and project rules.

## 1. Environment & Infrastructure
### 🐳 Docker First Policy
- **Rule**: All development, dependency installation, and execution MUST be performed inside the Docker containers.
- **Reasoning**: Ensures consistency across environments and prevents "works on my machine" issues.
- **Workflow**:
    - **Do NOT** run `npm install` or `pip install` on your local host machine.
    - **DO** run commands via `docker exec` or inside a shell in the container.
    - Example: `docker exec frontend npm install <package>` instead of `npm install <package>`.

## 2. Frontend Architecture
### Styling
- Use **Tailwind CSS v4**.
- Avoid custom CSS files unless absolutely necessary (use `index.css` for global styles).

### Components
- Use **D3.js** for all financial charting (no TradingView widgets).
- Use **CodeMirror** for code editors (Pine Script).

## 3. Backend Architecture
- **FastAPI** for all API endpoints.
- **Pydantic** for data validation.
- **SQLAlchemy** (Async) for database interactions.

## 4. Version Control & Git Workflow
### 🚀 Automated Commits & Pushes
- **Capability**: The AI agent is authorized to perform Git commits and pushes to the remote repository.
- **Trigger**:
    - Explicit user request (e.g., "Please push changes").
    - Completion of a significant Milestone or Task.
- **Workflow**:
    1.  **Check Status**: `git status` to verify changes.
    2.  **Stage Changes**: `git add .` (or specific files).
    3.  **Commit**: `git commit -m "Type: Description of changes"` (e.g., "Feat: Implemented User Login").
    4.  **Push**: `git push` to the current branch.
- **Note**: Always ensure the branch is up-to-date before pushing.
