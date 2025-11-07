# backend/app.py
from flask import Flask, jsonify, request
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from datetime import datetime
import os
import time
import random
import string
from urllib.parse import quote_plus

# Load environment variables
try:
    from dotenv import load_dotenv
except Exception:
    def load_dotenv(dotenv_path='.env', override=False):
        """Lightweight .env loader"""
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

# --- INITIALIZE FLASK ---
app = Flask(__name__)
CORS(app)

# --- DATABASE CONFIGURATION ---
# Build database URL with encoded password
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

# --- DATABASE MODELS (CORRECTED) ---

class Product(db.Model):
    __tablename__ = 'products'
    id = db.Column(db.String(50), primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    defaultPrice = db.Column('default_price', db.Float, nullable=False)

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'defaultPrice': self.defaultPrice
        }

class Subscription(db.Model):
    __tablename__ = 'subscriptions'
    id = db.Column(db.String(50), primary_key=True)
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
    customerName = db.Column('customer_name', db.String(100), nullable=False)
    products = db.Column(db.JSON)
    totalAmount = db.Column('total_amount', db.Float, nullable=False)
    date = db.Column(db.String(50), nullable=False)
    status = db.Column(db.String(50), nullable=False)

    def to_dict(self):
        return {
            'id': self.id,
            'customerName': self.customerName,
            'products': self.products,
            'totalAmount': self.totalAmount,
            'date': self.date,
            'status': self.status
        }

class WholesaleSale(db.Model):
    __tablename__ = 'wholesale_sales'
    id = db.Column(db.String(50), primary_key=True)
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

# --- PRODUCTS ENDPOINTS ---
@app.route('/api/products', methods=['GET'])
def get_products():
    products = Product.query.all()
    return jsonify([p.to_dict() for p in products])

@app.route('/api/products', methods=['POST'])
def add_product():
    data = request.get_json()
    data['id'] = generate_id('prod')
    product = Product(**data)
    db.session.add(product)
    db.session.commit()
    return jsonify(product.to_dict()), 201

@app.route('/api/products/<string:prod_id>', methods=['PUT'])
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

@app.route('/api/products/<string:prod_id>', methods=['DELETE'])
def delete_product(prod_id):
    prod = Product.query.get(prod_id)
    if not prod:
        return jsonify({'error': 'Product not found'}), 404
    db.session.delete(prod)
    db.session.commit()
    return jsonify({'message': 'Product deleted'}), 200

# --- SUBSCRIPTIONS ENDPOINTS ---
@app.route('/api/subscriptions', methods=['GET'])
def get_subscriptions():
    subs = Subscription.query.all()
    return jsonify([s.to_dict() for s in subs])

@app.route('/api/subscriptions', methods=['POST'])
def add_subscription():
    data = request.get_json()
    data['id'] = generate_id('sub')
    sub = Subscription(**data)
    db.session.add(sub)
    db.session.commit()
    return jsonify(sub.to_dict()), 201

@app.route('/api/subscriptions/<string:sub_id>', methods=['PUT'])
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

@app.route('/api/subscriptions/<string:sub_id>', methods=['DELETE'])
def delete_subscription(sub_id):
    sub = Subscription.query.get(sub_id)
    if not sub:
        return jsonify({'error': 'Subscription not found'}), 404
    db.session.delete(sub)
    db.session.commit()
    return jsonify({'message': 'Subscription deleted'}), 200

# --- SALES ENDPOINTS ---
@app.route('/api/sales', methods=['GET'])
def get_sales():
    sales = Sale.query.all()
    return jsonify([s.to_dict() for s in sales])

@app.route('/api/sales', methods=['POST'])
def add_sale():
    data = request.get_json()
    data['id'] = generate_id('sale')
    sale = Sale(**data)
    db.session.add(sale)
    db.session.commit()
    return jsonify(sale.to_dict()), 201

@app.route('/api/sales/<string:sale_id>', methods=['PUT'])
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

@app.route('/api/sales/<string:sale_id>', methods=['DELETE'])
def delete_sale(sale_id):
    sale = Sale.query.get(sale_id)
    if not sale:
        return jsonify({'error': 'Sale not found'}), 404
    db.session.delete(sale)
    db.session.commit()
    return jsonify({'message': 'Sale deleted'}), 200

# --- WHOLESALE SALES ENDPOINTS ---
@app.route('/api/wholesale-sales', methods=['GET'])
def get_wholesale_sales():
    sales = WholesaleSale.query.all()
    return jsonify([s.to_dict() for s in sales])

@app.route('/api/wholesale-sales', methods=['POST'])
def add_wholesale_sale():
    data = request.get_json()
    data['id'] = generate_id('wsale')
    sale = WholesaleSale(**data)
    db.session.add(sale)
    db.session.commit()
    return jsonify(sale.to_dict()), 201

@app.route('/api/wholesale-sales/<string:sale_id>', methods=['PUT'])
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

@app.route('/api/wholesale-sales/<string:sale_id>', methods=['DELETE'])
def delete_wholesale_sale(sale_id):
    sale = WholesaleSale.query.get(sale_id)
    if not sale:
        return jsonify({'error': 'Wholesale sale not found'}), 404
    db.session.delete(sale)
    db.session.commit()
    return jsonify({'message': 'Wholesale sale deleted'}), 200

# --- EXPENSES ENDPOINTS ---
@app.route('/api/expenses', methods=['GET'])
def get_expenses():
    expenses = Expense.query.all()
    return jsonify([e.to_dict() for e in expenses])

@app.route('/api/expenses', methods=['POST'])
def add_expense():
    data = request.get_json()
    data['id'] = generate_id('exp')
    expense = Expense(**data)
    db.session.add(expense)
    db.session.commit()
    return jsonify(expense.to_dict()), 201

@app.route('/api/expenses/<string:exp_id>', methods=['PUT'])
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

@app.route('/api/expenses/<string:exp_id>', methods=['DELETE'])
def delete_expense(exp_id):
    exp = Expense.query.get(exp_id)
    if not exp:
        return jsonify({'error': 'Expense not found'}), 404
    db.session.delete(exp)
    db.session.commit()
    return jsonify({'message': 'Expense deleted'}), 200


@app.route('/api/debug/schema', methods=['GET'])
def debug_schema():
    from sqlalchemy import inspect
    inspector = inspect(db.engine)
    
    schemas = {}
    for table_name in ['sales', 'products', 'subscriptions', 'wholesale_sales', 'expenses']:
        try:
            columns = inspector.get_columns(table_name)
            schemas[table_name] = [col['name'] for col in columns]
        except Exception as e:
            schemas[table_name] = str(e)
    
    return jsonify(schemas)



# --- DASHBOARD STATS ENDPOINT ---
@app.route('/api/dashboard-stats', methods=['GET'])
def get_dashboard_stats():
    today = datetime.now()
    
    # Get current month sales
    current_month_sales = [s for s in Sale.query.all() if is_current_month(s.date)]
    current_month_wholesale = [ws for ws in WholesaleSale.query.all() if is_current_month(ws.date)]
    current_month_expenses = [e for e in Expense.query.all() if is_current_month(e.date)]
    
    total_sales = sum(s.totalAmount for s in current_month_sales) + sum(ws.totalAmount for ws in current_month_wholesale)
    total_expenses = sum(e.amount for e in current_month_expenses)
    
    # Sales by day
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
    
    # Expense breakdown
    expense_breakdown = {}
    for e in current_month_expenses:
        cat = e.category
        if cat not in expense_breakdown:
            expense_breakdown[cat] = 0
        expense_breakdown[cat] += e.amount
    
    # Build stats
    stats = {
        'currentMonthSales': total_sales,
        'activeSubscriptions': len([s for s in Subscription.query.all() if s.status == 'Active']),
        'currentMonthExpenses': total_expenses,
        'currentMonthProfit': total_sales - total_expenses,
        'salesByDay': [{'day': d, **data} for d, data in sales_by_day.items()],
        'expenseBreakdown': [{'name': name, 'value': value} for name, value in expense_breakdown.items()]
    }
    
    if stats['currentMonthProfit'] > 0:
        stats['expenseBreakdown'].append({'name': 'Net Profit', 'value': stats['currentMonthProfit']})
    
    return jsonify(stats)

# --- HEALTH CHECK ---
@app.route('/api/health', methods=['GET'])
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

# --- RUN THE APP ---
if __name__ == '__main__':
    with app.app_context():
        db.create_all()
        print("✓ Database tables created/verified")
    
    app.run(debug=True, port=5001)
