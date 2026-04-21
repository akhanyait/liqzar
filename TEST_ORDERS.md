# Test Orders Setup

## How to Create Test Orders

1. **Login as a customer** (not admin or driver)
   - Go to the app and sign in with a customer account
   - Or create a new customer account

2. **Open Browser Console**
   - Press `F12` or `Cmd+Option+I` (Mac) / `Ctrl+Shift+I` (Windows/Linux)
   - Click on the "Console" tab

3. **Run the script**

   ```javascript
   window.createTestOrders();
   ```

4. **Check the output**
   - You should see messages like:
     ```
     🚀 Creating test orders...
     ✅ User found: customer@example.com
     ✅ Found 10 products
     ✅ Created order: ORD-1234567890-ABCD
        ✅ Added 4 items to order
     ✅ Created order: ORD-1234567891-EFGH
        ✅ Added 2 items to order
     ✅ Created order: ORD-1234567892-IJKL
        ✅ Added 3 items to order
     🎉 Test orders created successfully!
     💡 Refresh the driver dashboard to see the new orders
     ```

5. **View the orders**
   - Login as a driver (phone: 062 153 2030)
   - Go to Driver Dashboard
   - You should see the new orders with **proper UUIDs**
   - Click "Verify Stock Now" to test scanning

## Test Orders Created

The script creates 3 test orders:

### Order 1 - Thabo Mokgadi

- **Address**: 42 Rivonia Road, Sandton
- **Items**: 4 products
- **Instructions**: "Please ring the doorbell"

### Order 2 - Naledi Khumalo

- **Address**: 12 Oxford Road, Rosebank
- **Items**: 2 products
- **Instructions**: "Leave with security"

### Order 3 - Sipho Ndlovu

- **Address**: 88 Umhlanga Rocks Drive, Umhlanga
- **Items**: 3 products
- **Instructions**: "Call on arrival"

## Troubleshooting

### "You must be logged in as a customer"

- Make sure you're logged in with a customer account
- Not an admin or driver account

### "Error fetching products"

- Ensure your products table has data
- Check Supabase database connection

### Orders not showing in driver dashboard

- Orders are created with status `"pending"`
- Driver dashboard fetches orders with status: `pending`, `preparing`, or `ready`
- Refresh the driver dashboard after creating orders

## Manual Verification

You can verify the orders were created in Supabase:

1. Go to Supabase Dashboard
2. Select your project
3. Click "Table Editor"
4. Open the `orders` table
5. Filter by `status = 'pending'`
6. You should see your test orders with proper UUIDs

## Database Schema

Orders created have:

- ✅ Valid UUID for `id`
- ✅ Valid UUID for `user_id` (customer)
- ✅ Status: `"pending"`
- ✅ Payment status: `"paid"`
- ✅ Delivery address (JSON)
- ✅ Order items with product references

Order items have:

- ✅ Valid UUID for `id`
- ✅ Valid UUID for `order_id`
- ✅ Valid UUID for `product_id`
- ✅ Product name and image
- ✅ Quantity (1-3 random)
- ✅ Unit price and subtotal
