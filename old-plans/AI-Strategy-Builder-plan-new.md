# AI Integration Task Plan
**Project:** Autarkic Trading Platform - AI Strategy Engine Integration  
**Version:** 1.0  
**Created:** 2025-12-05  
**Status:** Planning Phase

---

## 📋 Overview

This document outlines the complete implementation plan for integrating AI-powered Pine Script transpilation and custom charting enhancements into the Strategy Builder. The plan is divided into 6 phases with clear deliverables and dependencies.

**Key Objectives:**
1. Enable AI-powered Pine Script → Python transpilation
2. Implement dual-tab editor (Pine Script + Python)
3. Integrate with isolated Strategy Engine for execution
4. Add Indicator vs Strategy type separation
5. Enhance D3.js charts with FVG and Trendlines
6. Build AI-powered Strategy Composer

**Safety Protocol:** All changes must be **additive only**. No modifications to Auth, Paper Trading, or core database tables.

---

## 🎯 Phase 1: Database Schema & Backend Foundation

**Goal:** Prepare database and create AI transpiler service  
**Estimated Time:** 4-6 hours  
**Dependencies:** None

### Tasks

#### 1.1 Database Migration
- [ ] Create Alembic migration file
- [ ] Add new columns to `strategies` table:
  - `python_code` (Text, nullable) - Generated Python code
  - `type` (ENUM: 'INDICATOR', 'STRATEGY', default: 'STRATEGY')
  - `compiled_at` (DateTime, nullable) - Timestamp of last transpilation
- [ ] Run migration on development database
- [ ] Verify schema changes

**Estimated Time:** 1-2 hours

---

#### 1.2 AI Transpiler Service
- [ ] Create `backend/app/services/ai_transpiler.py`
- [ ] Implement `PineToPythonTranspiler` class
- [ ] Integrate with user API key retrieval from `user_api_keys` table
- [ ] Add error handling and fallback logic
- [ ] Write unit tests

**Estimated Time:** 2-3 hours

---

#### 1.3 API Endpoint
- [ ] Create `/api/v1/strategies/transpile` endpoint
- [ ] Add authentication middleware
- [ ] Implement request/response validation with Pydantic
- [ ] Test with sample Pine Script

**Estimated Time:** 1 hour

---

## 🎨 Phase 2: Frontend - Dual Tab Editor

**Goal:** Implement Pine Script + Python tab system with auto-injection  
**Estimated Time:** 6-8 hours  
**Dependencies:** Phase 1 complete

### Tasks

#### 2.1 Tab System in PineScriptPanel
- [ ] Add state for active tab (`'pine' | 'python'`)
- [ ] Create tab navigation UI
- [ ] Add second CodeMirror instance for Python
- [ ] Implement tab switching logic

**Estimated Time:** 2-3 hours

---

#### 2.2 "Generate Strategy Engine" Button
- [ ] Add button next to "Save" in header
- [ ] Implement transpilation API call
- [ ] Add loading state
- [ ] Auto-switch to Python tab on success
- [ ] Handle errors gracefully

**Estimated Time:** 2 hours

---

#### 2.3 Update StrategyBuilderView
- [ ] Add `pythonCode` state
- [ ] Pass `pythonCode` and `onPythonCodeChange` to PineScriptPanel
- [ ] Update save handler to include both codes
- [ ] Load `python_code` when selecting existing strategy

**Estimated Time:** 2-3 hours

---

## ⚙️ Phase 3: Strategy Engine Integration

**Goal:** Connect Python code execution to isolated strategy-engine container  
**Estimated Time:** 8-10 hours  
**Dependencies:** Phase 1 & 2 complete

### Tasks

#### 3.1 Strategy Engine Execution Endpoint
- [ ] Create `/execute` endpoint in strategy-engine service
- [ ] Implement sandboxed Python execution with `exec()`
- [ ] Add timeout and memory limits
- [ ] Return execution results (signals, errors)
- [ ] Add comprehensive error handling

**Estimated Time:** 4-5 hours

---

#### 3.2 Backend Proxy to Strategy Engine
- [ ] Create `backend/app/services/backtest_service.py`
- [ ] Add endpoint `/api/v1/backtest/run`
- [ ] Fetch OHLCV data from market service
- [ ] Forward to strategy-engine and return results
- [ ] Implement basic PnL calculation

**Estimated Time:** 3-4 hours

---

#### 3.3 Frontend Backtest Integration
- [ ] Update `BacktestPanel` to use Python code from Tab B
- [ ] Add date range picker
- [ ] Display backtest results (signals on chart, PnL metrics)
- [ ] Add loading state and error handling

**Estimated Time:** 1-2 hours

---

## 🏷️ Phase 4: Indicator vs Strategy Separation

**Goal:** Add type distinction and conditional UI behavior  
**Estimated Time:** 3-4 hours  
**Dependencies:** Phase 2 complete

### Tasks

#### 4.1 Save Dialog Enhancement
- [ ] Add radio button group in save flow
- [ ] Add `strategyType` state ('INDICATOR' | 'STRATEGY')
- [ ] Update save payload to include `type`

**Estimated Time:** 1 hour

---

#### 4.2 Conditional Backtest Button
- [ ] Disable "Run Backtest" button if type is INDICATOR
- [ ] Add tooltip explaining why it's disabled
- [ ] Update BacktestPanel to check strategy type

**Estimated Time:** 1 hour

---

#### 4.3 Strategy List Badges
- [ ] Add type badge in strategy list
- [ ] Use different colors (blue for STRATEGY, purple for INDICATOR)
- [ ] Add filtering by type (optional)

**Estimated Time:** 1-2 hours

---

## 📊 Phase 5: Chart Enhancements (FVG & Trendlines)

**Goal:** Add Fair Value Gap visualization and drawing tools  
**Estimated Time:** 10-12 hours  
**Dependencies:** None (can run in parallel)

### Tasks

#### 5.1 FVG Visualization (Frontend - Mock Data)
- [ ] Add `shapes` prop to D3Chart
- [ ] Implement rectangle rendering for FVG zones
- [ ] Add legend/labels for FVG types (Bullish/Bearish)
- [ ] Create mock FVG data for testing
- [ ] Test performance with multiple FVGs

**Estimated Time:** 4-5 hours

---

#### 5.2 Trendline Drawing Tool
- [ ] Add "Draw Trendline" button to chart toolbar
- [ ] Implement mouse event handlers (click to start, click to end)
- [ ] Convert pixel coordinates to time/price
- [ ] Store trendlines in state
- [ ] Render trendlines as SVG lines
- [ ] Add delete/edit functionality

**Estimated Time:** 4-5 hours

---

#### 5.3 FVG Detection Backend (Phase 2 - Optional)
- [ ] Create `backend/app/services/fvg_detector.py`
- [ ] Implement FVG detection algorithm
- [ ] Add endpoint `/api/v1/market/fvg`
- [ ] Integrate with chart data fetching
- [ ] Test accuracy with historical data

**Estimated Time:** 2-3 hours

---

## 🧩 Phase 6: Strategy Composer (AI-Powered)

**Goal:** Enable combining indicators into strategies via AI  
**Estimated Time:** 6-8 hours  
**Dependencies:** Phase 1, 2, 4 complete

### Tasks

#### 6.1 Composer UI
- [ ] Add "Combine Indicators" button in Strategy Builder
- [ ] Create `StrategyComposerModal` component
- [ ] Add indicator selection dropdowns (filter by type=INDICATOR)
- [ ] Add text area for logic description (prompt)
- [ ] Implement "Generate" button

**Estimated Time:** 3-4 hours

---

#### 6.2 Composer Backend Endpoint
- [ ] Create `/api/v1/strategies/compose` endpoint
- [ ] Fetch indicator Python code from database
- [ ] Generate AI prompt combining both indicators
- [ ] Return combined Python code
- [ ] Add validation and error handling

**Estimated Time:** 2-3 hours

---

#### 6.3 Integration & Testing
- [ ] Test composer with real indicators
- [ ] Verify generated code is executable
- [ ] Add example prompts/templates
- [ ] Document composer workflow

**Estimated Time:** 1 hour

---

## ✅ Testing & Validation Checklist

### Phase 1
- [ ] Database migration runs without errors
- [ ] Transpiler successfully converts sample Pine Script
- [ ] User without Gemini key gets clear error message
- [ ] API endpoint returns valid Python code
- [ ] Unit tests pass

### Phase 2
- [ ] Tab switching works smoothly
- [ ] Python code persists when switching tabs
- [ ] "Generate Engine" button triggers transpilation
- [ ] Auto-switch to Python tab after generation
- [ ] Both codes save to database correctly
- [ ] Loading states work properly

### Phase 3
- [ ] Strategy engine executes Python code without crashes
- [ ] Signals are correctly extracted from DataFrame
- [ ] Backtest results display in UI
- [ ] Error messages are user-friendly
- [ ] Timeout protection works

### Phase 4
- [ ] Radio button correctly sets strategy type
- [ ] Backtest button is disabled for indicators
- [ ] Type badges display correctly in list
- [ ] Filtering by type works (if implemented)

### Phase 5
- [ ] FVG rectangles render at correct positions
- [ ] Trendlines can be drawn with mouse
- [ ] Chart performance remains smooth with overlays
- [ ] FVG detection algorithm is accurate (if implemented)
- [ ] Drawing tools are intuitive

### Phase 6
- [ ] Composer modal opens and closes correctly
- [ ] Indicator dropdowns populate correctly
- [ ] Generated strategy combines both indicators
- [ ] Result can be saved as new strategy
- [ ] AI prompts produce valid code

---

## 📊 Time Estimates Summary

| Phase | Tasks | Estimated Time |
|-------|-------|----------------|
| Phase 1 | Database + Transpiler | 4-6 hours |
| Phase 2 | Dual Tab Editor | 6-8 hours |
| Phase 3 | Strategy Engine | 8-10 hours |
| Phase 4 | Type Separation | 3-4 hours |
| Phase 5 | Chart Enhancements | 10-12 hours |
| Phase 6 | Strategy Composer | 6-8 hours |
| **Total** | | **37-48 hours** |

---

## 📝 Notes & Considerations

### Security
- All Python code execution happens in isolated strategy-engine container
- User API keys are encrypted in database
- No system-wide API keys for user actions
- Add rate limiting to transpile endpoint (max 10/minute)
- Validate generated Python code before execution

### Performance
- Cache transpilation results (store `compiled_at` timestamp)
- Limit backtest data to 1000 candles initially
- Use Web Workers for heavy chart rendering (if needed)
- Add pagination to strategy list
- Optimize D3.js rendering for large datasets

### Error Handling
- Graceful degradation if AI service is unavailable
- Clear error messages for invalid Pine Script
- Timeout protection for long-running backtests
- Validation of generated Python code before execution
- Fallback to manual Python editing if transpilation fails

### User Experience
- Add tooltips and help text throughout
- Provide example Pine Scripts for testing
- Show loading indicators for all async operations
- Add keyboard shortcuts for common actions
- Implement undo/redo for code editors

### Future Enhancements (Post-MVP)
- Multi-indicator composer (3+ indicators)
- Strategy marketplace (share/import strategies)
- Live trading integration (connect to paper trading)
- Advanced backtest metrics (Sharpe ratio, max drawdown, win rate)
- Strategy optimization (parameter tuning via AI)
- Version control for strategies (git-like history)
- Collaborative editing (multiple users)
- Mobile-responsive chart tools

---

## 🚀 Deployment Plan

### Development Phase
1. Create feature branch: `feature/ai-strategy-engine`
2. Implement phases sequentially (1 → 2 → 3 → 4 → 5 → 6)
3. Each phase must pass validation checklist before moving to next
4. Regular commits with descriptive messages
5. Code reviews after each phase

### Testing Phase
1. Unit tests for all backend services
2. Integration tests for API endpoints
3. E2E tests for critical user flows
4. Performance testing with large datasets
5. Security audit of Python execution sandbox

### Staging Deployment
1. Deploy to staging environment
2. Run full test suite
3. Manual QA testing
4. Load testing with concurrent users
5. Fix any bugs found

### Production Deployment
1. Deploy with feature flag (gradual rollout)
2. Monitor error rates and performance
3. Collect user feedback
4. Iterate based on feedback
5. Full rollout after 1 week of stability

### Rollback Strategy
- Keep old TradingView chart component as fallback
- Feature flag can disable AI transpiler if issues arise
- Database migration is reversible
- Strategy engine can be rolled back independently

---

## 📞 Support & Documentation

### User Documentation
- [ ] Create user guide for Pine Script editor
- [ ] Document AI transpilation process
- [ ] Add examples of valid Pine Scripts
- [ ] Explain Indicator vs Strategy difference
- [ ] Tutorial for Strategy Composer

### Developer Documentation
- [ ] API documentation for new endpoints
- [ ] Code comments for complex logic
- [ ] Architecture diagram for strategy engine flow
- [ ] Security best practices guide
- [ ] Troubleshooting guide

---

**Last Updated:** 2025-12-05  
**Next Review:** After Phase 3 completion  
**Owner:** Development Team  
**Status:** Ready for Implementation
