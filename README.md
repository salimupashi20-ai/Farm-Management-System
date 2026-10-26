# Farm Manager

A first version of a family farm management app, with prices in Zambian kwacha (ZMW).

## Features

- Sales and outstanding customer balances
- Stock receipts, usage and spoilage, with automatic deductions for sales
- Animal care records and follow-up dates for goats, sheep, chickens, ducks, turkeys and cattle
- Expenses, payments and balances
- Worker details, tasks, attendance and wages linked to expenses
- JSON backup export and restore
- Responsive layout and an offline cache

## Run locally

Open this folder in VS Code. With Python 3 installed, run:

```sh
python3 -m http.server 8000 --directory dist
```

Open http://localhost:8000 in your browser. No package installation or build step is required. The editable application files are in `dist/`.

## Current limitations

This is a prototype. Records are stored in the current browser on the current device. There is no shared database, family sign-in, or cross-device synchronization. Export backups regularly: clearing browser data can remove records.

Offline caching is implemented but has not been verified on iPhone or Android or behind the hosted private access gateway. Do not rely on offline availability yet.

Browser checks covered stock entry, rejection of sales beyond available stock, sale stock deductions, unpaid sale balances, and wage records appearing in expenses.

The `.openai/hosting.json` file identifies the existing private Sites deployment. Pushing to GitHub alone does not publish changes to that deployment.
