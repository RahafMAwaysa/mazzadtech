# Remix of AI Bid Buddy

Build a clean, modern, mobile-first AI-powered reverse auction marketplace application specialized in electronics products such as laptops, smartphones, smart watches, projectors, cameras, and similar technology devices.

The main goal of the platform is to connect customers with verified suppliers. Customers should not search through products manually; instead, they describe what they need in their own words, and the AI assistant helps understand their requirements and converts them into a structured purchase request. Suppliers compete by submitting the best offers based on the customer's needs.

The application should have three user roles:

1. Customer

2. Supplier

3. Admin

--------------------------------

CUSTOMER EXPERIENCE

--------------------------------

Design the customer experience to be extremely simple, clean, and beginner-friendly. The user should understand the app immediately without training.

The home screen should focus on one main action:

"Tell us what you need"

Include an AI shopping assistant where customers can write naturally.

Example:

"I need a laptop for university programming, good performance, and my budget is 2500 NIS."

The AI assistant should:

- Ask smart follow-up questions.

- Understand customer priorities.

- Clarify missing information.

- Avoid technical complexity.

- Convert the conversation into a structured purchase request.

The AI should collect:

- Product category

- Budget

- Required specifications

- Main purpose of use

- Preferred brands (optional)

- Warranty preference

- Delivery preference

- Any additional requirements

Before sending the request, show the customer a summary:

"Here is what we understood from your request"

Allow the customer to:

- Confirm request

- Edit request

--------------------------------

REVERSE AUCTION SYSTEM

--------------------------------

After confirmation, send the request to matching verified suppliers.

Suppliers should submit offers including:

- Product name and model

- Product images

- Product specifications

- Price

- Warranty details

- Delivery time

- Additional benefits (free accessories, installation, etc.)

- Supplier rating

Customers should compare offers easily.

Do not rank offers only by price.

Create an AI Match Score system:

Example:

Offer Match: 94%

Reasons:

✓ Meets required specifications

✓ Fits customer's budget

✓ Strong warranty

✓ High supplier rating

✓ Suitable delivery time

Allow customers to:

- View recommended offers

- View all offers

- Filter offers

Filters:

- Lowest price

- Highest supplier rating

- Warranty period

- Delivery speed

- Specifications (RAM, storage, camera quality, battery, etc.)

--------------------------------

SUPPLIER EXPERIENCE

--------------------------------

Create a separate supplier interface.

Suppliers can:

- Create a verified supplier profile

- Select product categories they provide

- Receive matching customer requests

- Submit competitive offers

- Update order status

Supplier profile should include:

- Verification status

- Rating

- Previous completed orders

- Response rate

Suppliers should not see customer identity.

Customers should not see supplier identity until the appropriate stage.

--------------------------------

ORDER AND PAYMENT FLOW

--------------------------------

Create a realistic checkout experience.

Payment methods:

- Credit/Debit card

- Digital wallet

- Cash on delivery

For prototype purposes, simulate successful payment.

After payment, generate an order page with:

Order number

Order status

Supplier preparation status

--------------------------------

DELIVERY TRACKING

--------------------------------

Create an order tracking experience:

Timeline:

✓ Order confirmed

✓ Supplier preparing product

✓ Product checked by platform

✓ Out for delivery

✓ Delivered

Include a simple tracking map simulation.

--------------------------------

TRUST AND SECURITY FEATURES

--------------------------------

Because customers do not directly know suppliers, emphasize trust.

Include:

- Verified suppliers badge

- Product verification by platform

- Supplier ratings

- Warranty information

- Secure payment

- Customer support

--------------------------------

ADMIN DASHBOARD

--------------------------------

Create an admin panel to manage:

- Customers

- Suppliers

- Supplier verification

- Orders

- Payments

- Platform commission

- Reports

--------------------------------

DESIGN REQUIREMENTS

--------------------------------

The design should be:

- Minimal

- Clean

- Modern

- Professional

- Easy for first-time users

Avoid:

- Crowded screens

- Too many buttons

- Complicated forms

Use:

- White space

- Clear typography

- Simple cards

- Smooth navigation

- Friendly AI assistant interface

The application should feel like a combination of:

- Smart shopping assistant

- Marketplace

- Reverse auction platform

The main design principle:

"The platform understands the customer instead of forcing the customer to understand the platform."

Build a functional prototype suitable for a university project demonstration.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://mazzadtech.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/9c550c44-a7cd-49b3-947b-bd1ec200068e).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
