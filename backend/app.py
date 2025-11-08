from flask import Flask, jsonify, request
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from datetime import datetime
from collections import defaultdict
import os
import time
import random
import string
from urllib.parse import quote_plus

# --- LOAD ENV ---
try:
    from dotenv import load_dotenv
except Exception:
    def load_dotenv(dotenv_path='.env', override=False):
        try:
            if not os.path.exists(dotenv_path):
                return False
            with open(dotenv_path, 'r', encoding='utf-8') as f:
                for line in f:
                    line = line.strip()
                    if not line or line.startswith('#'):
                        continue
                    if '=' not in line:
                        continue
                    key, val = line.split('=', 1)
                    key = key.strip()
                    val = val.strip().strip('\'"')
                    if override or key not in os.environ:
                        os.environ[key] = val
            return True
        except Exception:
            return False

load_dotenv()

# --- FLASK SETUP ---
app = Flask(__name__)
CORS(app)

# --- DATABASE CONFIG ---
db_user = os.getenv('DB_USER', 'postgres')
db_password = quote_plus(os.getenv('DB_PASSWORD', ''))
db_host = os.getenv('DB_HOST', '')
db_port = os.getenv('DB_PORT', '5432')
db_name = os.getenv('DB_NAME', 'postgres')

database_url = f'postgresql://{db_user}:{db_password}@{db_host}:{db_port}/{db_name}'

app.config['SQLALCHEMY_DATABASE_URI'] = database_url
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['SQLALCHEMY_ENGINE_OPTIONS'] = {
    'pool_pre_ping': True,
    'pool_recycle': 300,
}

db = SQLAlchemy(app)

# --- HELPER FUNCTIONS ---
def generate_id(prefix):
    timestamp = int(time.time() * 1000)
    random_str = ''.join(random.choices(string.ascii_lowercase + string.digits, k=6))
    return f"{prefix}_{timestamp}_{random_str}"

def is_current_month(date_str):
    try:
        date_obj = datetime.strptime(date_str, '%Y-%m-%d')
        today = datetime.now()
        return date_obj.month == today.month and date_obj.year == today.year
    except:
        return False

# --- DATABASE MODELS ---

class Product(db.Model):
    __tablename__ = 'products'
    id = db.Column(db.String(50), primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    defaultPrice = db.Column('default_price', db.Float, nullable=False)
    unit = db.Column(db.String(50), default='kg')

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'defaultPrice': self.defaultPrice,
            'unit': self.unit
        }

class Subscription(db.Model):
    __tablename__ = 'subscriptions'
    id = db.Column(db.String(50), primary_key=True)
    invoiceNumber = db.Column('invoice_number', db.String(50), unique=True)
    name = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(100), nullable=False)
    phone = db.Column(db.String(20))
    address = db.Column(db.String(200))
    flatNo = db.Column('flat_no', db.String(50))
    plan = db.Column(db.String(100), nullable=False)
    status = db.Column(db.String(50), nullable=False)
    startDate = db.Column('start_date', db.String(50), nullable=False)

    def to_dict(self):
        return {
            'id': self.id,
            'invoiceNumber': self.invoiceNumber,
            'name': self.name,
            'email': self.email,
            'phone': self.phone,
            'address': self.address,
            'flatNo': self.flatNo,
            'plan': self.plan,
            'status': self.status,
            'startDate': self.startDate
        }

class Sale(db.Model):
    __tablename__ = 'sales'
    id = db.Column(db.String(50), primary_key=True)
    invoiceNumber = db.Column('invoice_number', db.String(50), unique=True)
    customerName = db.Column('customer_name', db.String(100), nullable=False)
    products = db.Column(db.JSON)
    totalAmount = db.Column('total_amount', db.Float, nullable=False)
    date = db.Column(db.String(50), nullable=False)
    status = db.Column(db.String(50), nullable=False)

    def to_dict(self):
        return {
            'id': self.id,
            'invoiceNumber': self.invoiceNumber,
            'customerName': self.customerName,
            'products': self.products,
            'totalAmount': self.totalAmount,
            'date': self.date,
            'status': self.status
        }

class WholesaleSale(db.Model):
    __tablename__ = 'wholesale_sales'
    id = db.Column(db.String(50), primary_key=True)
    invoiceNumber = db.Column('invoice_number', db.String(50), unique=True)
    shopName = db.Column('shop_name', db.String(100), nullable=False)
    contact = db.Column(db.String(100))
    address = db.Column(db.String(200))
    products = db.Column(db.JSON)
    totalAmount = db.Column('total_amount', db.Float, nullable=False)
    date = db.Column(db.String(50), nullable=False)
    status = db.Column(db.String(50), nullable=False)

    def to_dict(self):
        return {
            'id': self.id,
            'invoiceNumber': self.invoiceNumber,
            'shopName': self.shopName,
            'contact': self.contact,
            'address': self.address,
            'products': self.products,
            'totalAmount': self.totalAmount,
            'date': self.date,
            'status': self.status
        }

class Expense(db.Model):
    __tablename__ = 'expenses'
    id = db.Column(db.String(50), primary_key=True)
    category = db.Column(db.String(100), nullable=False)
    description = db.Column(db.String(200), nullable=False)
    amount = db.Column(db.Float, nullable=False)
    date = db.Column(db.String(50), nullable=False)

    def to_dict(self):
        return {
            'id': self.id,
            'category': self.category,
            'description': self.description,
            'amount': self.amount,
            'date': self.date
        }

class Warehouse(db.Model):
    __tablename__ = 'warehouses'
    id = db.Column(db.String(50), primary_key=True)
    name = db.Column(db.String(100), nullable=False)

    def to_dict(self):
        return {'id': self.id, 'name': self.name}

class Inventory(db.Model):
    __tablename__ = 'inventory'
    id = db.Column(db.String(50), primary_key=True)
    productId = db.Column('product_id', db.String(50), nullable=False)
    warehouseId = db.Column('warehouse_id', db.String(50), nullable=False)
    quantity = db.Column(db.Integer, default=0)

    def to_dict(self):
        return {
            'id': self.id,
            'productId': self.productId,
            'warehouseId': self.warehouseId,
            'quantity': self.quantity
        }

class SalesReturn(db.Model):
    __tablename__ = 'sales_returns'
    id = db.Column(db.String(50), primary_key=True)
    saleId = db.Column('sale_id', db.String(50), nullable=False)
    returnedProducts = db.Column('returned_products', db.JSON)
    date = db.Column(db.String(50), nullable=False)

    def to_dict(self):
        return {
            'id': self.id,
            'saleId': self.saleId,
            'returnedProducts': self.returnedProducts,
            'date': self.date
        }

class InvoiceCounter(db.Model):
    __tablename__ = 'invoice_counters'
    id = db.Column(db.String(50), primary_key=True)
    counterType = db.Column('counter_type', db.String(50), unique=True, nullable=False)
    currentNumber = db.Column('current_number', db.Integer, default=0)

    def to_dict(self):
        return {
            'id': self.id,
            'counterType': self.counterType,
            'currentNumber': self.currentNumber
        }

# --- INVOICE NUMBER HELPER ---
def get_next_invoice_number(counter_type):
    counter = InvoiceCounter.query.filter_by(counterType=counter_type).first()
    if not counter:
        counter = InvoiceCounter(id=generate_id('ic'), counterType=counter_type, currentNumber=0)
        db.session.add(counter)
        db.session.commit()
    
    current_number = counter.currentNumber + 1
    counter.currentNumber = current_number
    db.session.commit()
    
    prefix_map = {
        "subscription": "SUB",
        "sale": "INV",
        "wholesale_sale": "WS"
    }
    return f"{prefix_map.get(counter_type, 'N/A')}-{current_number}"

# --- INVENTORY HELPERS ---
def update_inventory(product_id, warehouse_id, quantity_change):
    inventory = Inventory.query.filter_by(productId=product_id, warehouseId=warehouse_id).first()
    if not inventory:
        if quantity_change > 0:
            inventory = Inventory(id=generate_id('inv'), productId=product_id, warehouseId=warehouse_id, quantity=quantity_change)
            db.session.add(inventory)
        else:
            raise ValueError(f"Not enough stock for product {product_id}")
    else:
        inventory.quantity += quantity_change
        if inventory.quantity < 0:
            raise ValueError(f"Not enough stock for product {product_id}")
    db.session.commit()

def check_stock_availability(products_list, warehouse_id):
    for product in products_list:
        product_id = product.get('productId')
        required_qty = product.get('quantity', 0)
        inventory = Inventory.query.filter_by(productId=product_id, warehouseId=warehouse_id).first()
        available_qty = inventory.quantity if inventory else 0
        if required_qty > available_qty:
            return False, f"Not enough stock for {product_id}. Required: {required_qty}, Available: {available_qty}"
    return True, ""

# --- PRODUCTS ENDPOINTS ---
@app.route('/products', methods=['GET'])
def get_products():
    products = Product.query.all()
    return jsonify([p.to_dict() for p in products])

@app.route('/products', methods=['POST'])
def add_product():
    data = request.get_json()
    data['id'] = generate_id('prod')
    product = Product(**data)
    db.session.add(product)
    db.session.commit()
    return jsonify(product.to_dict()), 201

@app.route('/products/<string:prod_id>', methods=['PUT'])
def update_product(prod_id):
    data = request.get_json()
    prod = Product.query.get(prod_id)
    if not prod:
        return jsonify({'error': 'Product not found'}), 404
    for key, value in data.items():
        if hasattr(prod, key):
            setattr(prod, key, value)
    db.session.commit()
    return jsonify(prod.to_dict())

@app.route('/products/<string:prod_id>', methods=['DELETE'])
def delete_product(prod_id):
    prod = Product.query.get(prod_id)
    if not prod:
        return jsonify({'error': 'Product not found'}), 404
    db.session.delete(prod)
    db.session.commit()
    return jsonify({'message': 'Product deleted'}), 200

# --- SUBSCRIPTIONS ENDPOINTS ---
@app.route('/subscriptions', methods=['GET'])
def get_subscriptions():
    subs = Subscription.query.all()
    return jsonify([s.to_dict() for s in subs])

@app.route('/subscriptions', methods=['POST'])
def add_subscription():
    data = request.get_json()
    data['id'] = generate_id('sub')
    data['invoiceNumber'] = get_next_invoice_number('subscription')
    sub = Subscription(**data)
    db.session.add(sub)
    db.session.commit()
    return jsonify(sub.to_dict()), 201

@app.route('/subscriptions/<string:sub_id>', methods=['PUT'])
def update_subscription(sub_id):
    data = request.get_json()
    sub = Subscription.query.get(sub_id)
    if not sub:
        return jsonify({'error': 'Subscription not found'}), 404
    for key, value in data.items():
        if hasattr(sub, key):
            setattr(sub, key, value)
    db.session.commit()
    return jsonify(sub.to_dict())

@app.route('/subscriptions/<string:sub_id>', methods=['DELETE'])
def delete_subscription(sub_id):
    sub = Subscription.query.get(sub_id)
    if not sub:
        return jsonify({'error': 'Subscription not found'}), 404
    db.session.delete(sub)
    db.session.commit()
    return jsonify({'message': 'Subscription deleted'}), 200

# --- SALES ENDPOINTS ---
@app.route('/sales', methods=['GET'])
def get_sales():
    sales = Sale.query.all()
    return jsonify([s.to_dict() for s in sales])

@app.route('/sales', methods=['POST'])
def add_sale():
    data = request.get_json()
    warehouse_id = data.get('warehouseId', 'default')
    products_in_sale = data.get('products', [])
    
    is_available, message = check_stock_availability(products_in_sale, warehouse_id)
    if not is_available:
        return jsonify({'error': message}), 400
    
    for p in products_in_sale:
        update_inventory(p['productId'], warehouse_id, -p['quantity'])
    
    data['id'] = generate_id('sale')
    data['invoiceNumber'] = get_next_invoice_number('sale')
    sale = Sale(**data)
    db.session.add(sale)
    db.session.commit()
    return jsonify(sale.to_dict()), 201

@app.route('/sales/<string:sale_id>', methods=['PUT'])
def update_sale(sale_id):
    data = request.get_json()
    sale = Sale.query.get(sale_id)
    if not sale:
        return jsonify({'error': 'Sale not found'}), 404
    for key, value in data.items():
        if hasattr(sale, key):
            setattr(sale, key, value)
    db.session.commit()
    return jsonify(sale.to_dict())

@app.route('/sales/<string:sale_id>', methods=['DELETE'])
def delete_sale(sale_id):
    sale = Sale.query.get(sale_id)
    if not sale:
        return jsonify({'error': 'Sale not found'}), 404
    
    warehouse_id = request.args.get('warehouseId', 'default')
    for p in sale.products or []:
        update_inventory(p['productId'], warehouse_id, p['quantity'])
    
    db.session.delete(sale)
    db.session.commit()
    return jsonify({'message': 'Sale deleted'}), 200

# --- WHOLESALE SALES ENDPOINTS ---
@app.route('/wholesale-sales', methods=['GET'])
def get_wholesale_sales():
    sales = WholesaleSale.query.all()
    return jsonify([s.to_dict() for s in sales])

@app.route('/wholesale-sales', methods=['POST'])
def add_wholesale_sale():
    data = request.get_json()
    warehouse_id = data.get('warehouseId', 'default')
    products_in_sale = data.get('products', [])
    
    is_available, message = check_stock_availability(products_in_sale, warehouse_id)
    if not is_available:
        return jsonify({'error': message}), 400
    
    for p in products_in_sale:
        update_inventory(p['productId'], warehouse_id, -p['quantity'])
    
    data['id'] = generate_id('wsale')
    data['invoiceNumber'] = get_next_invoice_number('wholesale_sale')
    sale = WholesaleSale(**data)
    db.session.add(sale)
    db.session.commit()
    return jsonify(sale.to_dict()), 201

@app.route('/wholesale-sales/<string:sale_id>', methods=['PUT'])
def update_wholesale_sale(sale_id):
    data = request.get_json()
    sale = WholesaleSale.query.get(sale_id)
    if not sale:
        return jsonify({'error': 'Wholesale sale not found'}), 404
    for key, value in data.items():
        if hasattr(sale, key):
            setattr(sale, key, value)
    db.session.commit()
    return jsonify(sale.to_dict())

@app.route('/wholesale-sales/<string:sale_id>', methods=['DELETE'])
def delete_wholesale_sale(sale_id):
    sale = WholesaleSale.query.get(sale_id)
    if not sale:
        return jsonify({'error': 'Wholesale sale not found'}), 404
    
    warehouse_id = request.args.get('warehouseId', 'default')
    for p in sale.products or []:
        update_inventory(p['productId'], warehouse_id, p['quantity'])
    
    db.session.delete(sale)
    db.session.commit()
    return jsonify({'message': 'Wholesale sale deleted'}), 200

# --- EXPENSES ENDPOINTS ---
@app.route('/expenses', methods=['GET'])
def get_expenses():
    expenses = Expense.query.all()
    return jsonify([e.to_dict() for e in expenses])

@app.route('/expenses', methods=['POST'])
def add_expense():
    data = request.get_json()
    data['id'] = generate_id('exp')
    expense = Expense(**data)
    db.session.add(expense)
    db.session.commit()
    return jsonify(expense.to_dict()), 201

@app.route('/expenses/<string:exp_id>', methods=['PUT'])
def update_expense(exp_id):
    data = request.get_json()
    exp = Expense.query.get(exp_id)
    if not exp:
        return jsonify({'error': 'Expense not found'}), 404
    for key, value in data.items():
        if hasattr(exp, key):
            setattr(exp, key, value)
    db.session.commit()
    return jsonify(exp.to_dict())

@app.route('/expenses/<string:exp_id>', methods=['DELETE'])
def delete_expense(exp_id):
    exp = Expense.query.get(exp_id)
    if not exp:
        return jsonify({'error': 'Expense not found'}), 404
    db.session.delete(exp)
    db.session.commit()
    return jsonify({'message': 'Expense deleted'}), 200

# --- WAREHOUSES ENDPOINTS ---
@app.route('/warehouses', methods=['GET'])
def get_warehouses():
    warehouses = Warehouse.query.all()
    return jsonify([w.to_dict() for w in warehouses])

@app.route('/warehouses', methods=['POST'])
def add_warehouse():
    data = request.get_json()
    warehouse = Warehouse(id=generate_id('wh'), name=data['name'])
    db.session.add(warehouse)
    db.session.commit()
    return jsonify(warehouse.to_dict()), 201

@app.route('/api/warehouses/<string:wh_id>', methods=['PUT'])
def update_warehouse(wh_id):
    data = request.get_json()
    wh = Warehouse.query.get(wh_id)
    if not wh:
        return jsonify({'error': 'Warehouse not found'}), 404
    wh.name = data['name']
    db.session.commit()
    return jsonify(wh.to_dict())

@app.route('/warehouses/<string:wh_id>', methods=['DELETE'])
def delete_warehouse(wh_id):
    inventory_items = Inventory.query.filter_by(warehouseId=wh_id).all()
    if any(item.quantity > 0 for item in inventory_items):
        return jsonify({'error': 'Cannot delete warehouse with stock'}), 400
    wh = Warehouse.query.get(wh_id)
    if wh:
        db.session.delete(wh)
        db.session.commit()
    return jsonify({'message': 'Warehouse deleted'}), 200

# --- INVENTORY ENDPOINTS ---
@app.route('/inventory', methods=['GET'])
def get_inventory():
    inventory = Inventory.query.all()
    products = {p.id: p for p in Product.query.all()}
    warehouses = {w.id: w for w in Warehouse.query.all()}
    
    enriched = []
    for item in inventory:
        enriched_item = item.to_dict()
        enriched_item['productName'] = products.get(item.productId, {}).name if item.productId in products else 'Unknown'
        enriched_item['warehouseName'] = warehouses.get(item.warehouseId, {}).name if item.warehouseId in warehouses else 'Unknown'
        enriched.append(enriched_item)
    return jsonify(enriched)

@app.route('/inventory/stock', methods=['POST'])
def add_inventory_stock():
    data = request.get_json()
    inventory = Inventory.query.filter_by(productId=data['productId'], warehouseId=data['warehouseId']).first()
    
    if not inventory:
        inventory = Inventory(id=generate_id('inv'), productId=data['productId'], warehouseId=data['warehouseId'], quantity=data['quantity'])
        db.session.add(inventory)
    else:
        inventory.quantity += data['quantity']
    
    db.session.commit()
    return jsonify(inventory.to_dict()), 201

# --- SALES RETURNS ENDPOINTS ---
@app.route('/sales-returns', methods=['GET'])
def get_sales_returns():
    returns = SalesReturn.query.all()
    return jsonify([r.to_dict() for r in returns])

@app.route('/sales-returns', methods=['POST'])
def add_sales_return():
    try:
        data = request.get_json()
        warehouse_id = data.get('warehouseId', 'default')
        
        # Validate required fields
        if not data.get('saleId'):
            return jsonify({'error': 'Missing saleId'}), 400
        if not data.get('returnedProducts') or len(data['returnedProducts']) == 0:
            return jsonify({'error': 'No products to return'}), 400
        
        # Add stock back for returned products
        for p in data.get('returnedProducts', []):
            # Handle both 'productId' and 'id' field names
            product_id = p.get('productId') or p.get('id')
            quantity = p.get('quantity', 0)
            
            if not product_id:
                return jsonify({'error': f'Product ID missing in returned product: {p}'}), 400
            
            if quantity <= 0:
                return jsonify({'error': f'Invalid quantity for product {product_id}'}), 400
            
            try:
                update_inventory(product_id, warehouse_id, quantity)
            except Exception as e:
                return jsonify({'error': f'Inventory update failed: {str(e)}'}), 400
        
        # Create sales return record
        sales_return = SalesReturn(
            id=generate_id('ret'),
            saleId=data['saleId'],
            returnedProducts=data.get('returnedProducts'),
            date=data.get('date', datetime.now().strftime('%Y-%m-%d'))
        )
        db.session.add(sales_return)
        db.session.commit()
        
        return jsonify(sales_return.to_dict()), 201
    
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Internal server error: {str(e)}'}), 500

# --- CUSTOMERS ENDPOINT (Aggregated) ---
@app.route('/customers', methods=['GET'])
def get_customers():
    customers_map = {}
    
    def get_customer_key(name, phone):
        return f"{name.lower().strip()}-{phone.strip()}"
    
    # Process subscriptions
    for sub in Subscription.query.all():
        key = get_customer_key(sub.name, sub.phone or '')
        if key not in customers_map:
            customers_map[key] = {
                'id': sub.id,
                'name': sub.name,
                'types': set(),
                'contact': {'email': sub.email, 'phone': sub.phone, 'address': sub.address},
                'totalSpent': 0,
                'firstActivityDate': sub.startDate,
                'lastActivityDate': sub.startDate,
                'transactionHistory': []
            }
        customers_map[key]['types'].add('Subscription')
        customers_map[key]['transactionHistory'].append({**sub.to_dict(), 'transactionType': 'Subscription'})
    
    # Process retail sales
    for sale in Sale.query.all():
        key = get_customer_key(sale.customerName, 'N/A_RETAIL')
        if key not in customers_map:
            customers_map[key] = {
                'id': sale.id,
                'name': sale.customerName,
                'types': set(),
                'contact': {'email': '', 'phone': '', 'address': ''},
                'totalSpent': 0,
                'firstActivityDate': sale.date,
                'lastActivityDate': sale.date,
                'transactionHistory': []
            }
        customers_map[key]['types'].add('Retail')
        customers_map[key]['totalSpent'] += sale.totalAmount
        customers_map[key]['transactionHistory'].append({**sale.to_dict(), 'transactionType': 'Retail'})
    
    # Process wholesale sales
    for sale in WholesaleSale.query.all():
        key = get_customer_key(sale.shopName, sale.contact or '')
        if key not in customers_map:
            customers_map[key] = {
                'id': sale.id,
                'name': sale.shopName,
                'types': set(),
                'contact': {'email': '', 'phone': sale.contact, 'address': sale.address},
                'totalSpent': 0,
                'firstActivityDate': sale.date,
                'lastActivityDate': sale.date,
                'transactionHistory': []
            }
        customers_map[key]['types'].add('Wholesale')
        customers_map[key]['totalSpent'] += sale.totalAmount
        customers_map[key]['transactionHistory'].append({**sale.to_dict(), 'transactionType': 'Wholesale'})
    
    # Convert sets to lists
    customer_list = list(customers_map.values())
    for customer in customer_list:
        customer['types'] = list(customer['types'])
        customer['transactionHistory'].sort(key=lambda t: t.get('date') or t.get('startDate'), reverse=True)
    
    return jsonify(customer_list)

# --- DASHBOARD STATS ---
@app.route('/dashboard-stats', methods=['GET'])
def get_dashboard_stats():
    current_month_sales = [s for s in Sale.query.all() if is_current_month(s.date)]
    current_month_wholesale = [ws for ws in WholesaleSale.query.all() if is_current_month(ws.date)]
    current_month_expenses = [e for e in Expense.query.all() if is_current_month(e.date)]
    
    total_sales = sum(s.totalAmount for s in current_month_sales) + sum(ws.totalAmount for ws in current_month_wholesale)
    total_expenses = sum(e.amount for e in current_month_expenses)
    
    sales_by_day = {}
    for s in current_month_sales:
        day = datetime.strptime(s.date, '%Y-%m-%d').day
        if day not in sales_by_day:
            sales_by_day[day] = {'sales': 0, 'retailOrders': 0, 'wholesaleOrders': 0}
        sales_by_day[day]['sales'] += s.totalAmount
        sales_by_day[day]['retailOrders'] += 1
    
    for ws in current_month_wholesale:
        day = datetime.strptime(ws.date, '%Y-%m-%d').day
        if day not in sales_by_day:
            sales_by_day[day] = {'sales': 0, 'retailOrders': 0, 'wholesaleOrders': 0}
        sales_by_day[day]['sales'] += ws.totalAmount
        sales_by_day[day]['wholesaleOrders'] += 1
    
    expense_breakdown = {}
    for e in current_month_expenses:
        cat = e.category
        expense_breakdown[cat] = expense_breakdown.get(cat, 0) + e.amount
    
    net_profit = total_sales - total_expenses
    
    stats = {
        'currentMonthSales': total_sales,
        'currentMonthRetailSales': sum(s.totalAmount for s in current_month_sales),
        'currentMonthWholesaleSales': sum(ws.totalAmount for ws in current_month_wholesale),
        'activeSubscriptions': len([s for s in Subscription.query.all() if s.status == 'Active']),
        'currentMonthExpenses': total_expenses,
        'currentMonthProfit': net_profit,
        'salesByDay': [{'day': d, **data} for d, data in sales_by_day.items()],
        'expenseBreakdown': [{'name': name, 'value': value} for name, value in expense_breakdown.items()]
    }
    
    if net_profit > 0:
        stats['expenseBreakdown'].append({'name': 'Net Profit', 'value': net_profit})
    
    return jsonify(stats)

# --- HEALTH CHECK ---
@app.route('/health', methods=['GET'])
def health():
    return jsonify({'status': 'OK', 'message': 'Backend is running'}), 200

# --- ERROR HANDLERS ---
@app.errorhandler(404)
def not_found(error):
    return jsonify({'error': 'Not found'}), 404

@app.errorhandler(500)
def internal_error(error):
    db.session.rollback()
    return jsonify({'error': 'Internal server error'}), 500

# --- RUN ---
if __name__ == '__main__':
    with app.app_context():
        db.create_all()
        print("✓ Database tables created/verified")
    app.run(debug=True, port=5001)

@app.route('/api/test-all', methods=['GET'])
def test_all():
    """Test all database connections"""
    from sqlalchemy import inspect
    inspector = inspect(db.engine)
    
    test_results = {
        'database_tables': {},
        'api_tests': {}
    }
    
    # Check tables exist
    for table_name in ['products', 'subscriptions', 'sales', 'wholesale_sales', 
                       'expenses', 'warehouses', 'inventory', 'sales_returns', 'invoice_counters']:
        try:
            if inspector.has_table(table_name):
                columns = [col['name'] for col in inspector.get_columns(table_name)]
                test_results['database_tables'][table_name] = {'exists': True, 'columns': columns}
            else:
                test_results['database_tables'][table_name] = {'exists': False}
        except Exception as e:
            test_results['database_tables'][table_name] = {'error': str(e)}
    
    # Test basic operations
    try:
        products = Product.query.count()
        test_results['api_tests']['products'] = f'{products} products found'
    except Exception as e:
        test_results['api_tests']['products'] = f'ERROR: {str(e)}'
    
    try:
        subscriptions = Subscription.query.count()
        test_results['api_tests']['subscriptions'] = f'{subscriptions} subscriptions found'
    except Exception as e:
        test_results['api_tests']['subscriptions'] = f'ERROR: {str(e)}'
    
    try:
        sales = Sale.query.count()
        test_results['api_tests']['sales'] = f'{sales} sales found'
    except Exception as e:
        test_results['api_tests']['sales'] = f'ERROR: {str(e)}'
    
    try:
        warehouses = Warehouse.query.count()
        test_results['api_tests']['warehouses'] = f'{warehouses} warehouses found'
    except Exception as e:
        test_results['api_tests']['warehouses'] = f'ERROR: {str(e)}'
    
    return jsonify(test_results), 200



