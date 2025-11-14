"""
Mushroom Business Management System - Backend API
Flask + SQLAlchemy + PostgreSQL (Supabase)
Production-Ready Version
"""

from flask import Flask, jsonify, request
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import Column, Integer, String, Float, Date, ForeignKey, Boolean, text
from sqlalchemy.dialects.postgresql import UUID

from datetime import datetime
import os
import time
import random
import string
import pytz
import csv
import io
from io import StringIO
from urllib.parse import quote_plus
from datetime import datetime, timedelta
from calendar import monthrange

# --- ENVIRONMENT SETUP ---
try:
    from dotenv import load_dotenv
except ImportError:
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

# --- FLASK APP INITIALIZATION ---
app = Flask(__name__)

# Enable CORS for all routes and methods
CORS(app, resources={
    r"/*": {
        "origins": ["*"],
        "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization"],
        "supports_credentials": True,
        "max_age": 3600
    }
})

# --- DATABASE CONFIGURATION ---
db_user = os.getenv('DB_USER', 'postgres')
db_password = quote_plus(os.getenv('DB_PASSWORD', ''))
db_host = os.getenv('DB_HOST', 'localhost')
db_port = os.getenv('DB_PORT', '5432')
db_name = os.getenv('DB_NAME', 'postgres')

database_url = f'postgresql://{db_user}:{db_password}@{db_host}:{db_port}/{db_name}'

app.config['SQLALCHEMY_DATABASE_URI'] = database_url
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['SQLALCHEMY_ENGINE_OPTIONS'] = {
    'pool_pre_ping': True,
    'pool_recycle': 300,
    'pool_timeout': 30,
    'pool_size': 10,
    'max_overflow': 20
}

db = SQLAlchemy(app)

# --- HELPER FUNCTIONS ---

def generate_id(prefix='id'):
    """Generate unique ID with timestamp and random string"""
    timestamp = int(time.time() * 1000)
    random_str = ''.join(random.choices(string.ascii_lowercase + string.digits, k=6))
    return f"{prefix}_{timestamp}_{random_str}"

def is_current_month(date_str):
    """Check if date string is in current month"""
    try:
        date_obj = datetime.strptime(date_str, '%Y-%m-%d')
        today = datetime.now()
        return date_obj.month == today.month and date_obj.year == today.year
    except:
        return False

# --- DATABASE MODELS ---

class Product(db.Model):
    """Product catalog"""
    __tablename__ = 'products'
    
    id = db.Column(db.String(50), primary_key=True)
    name = db.Column(db.String(100), nullable=False, unique=True)
    defaultPrice = db.Column('default_price', db.Float, nullable=False)
    unit = db.Column(db.String(50), default='kg')

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'defaultPrice': self.defaultPrice,
            'unit': self.unit
        }

def calculate_delivery_schedule(start_date_str, preferred_day, boxes_per_month):
    """Calculate delivery schedule - returns deliveries from TODAY onwards"""
    if not preferred_day or preferred_day == 'Any Day':
        return []
    
    # FIXED: Use TODAY as reference
    today = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
    
    day_map = {
        'Monday': 0, 'Tuesday': 1, 'Wednesday': 2, 'Thursday': 3,
        'Friday': 4, 'Saturday': 5, 'Sunday': 6
    }
    
    target_weekday = day_map.get(preferred_day)
    if target_weekday is None:
        return []
    
    # FIXED: Look FORWARD from today
    delivery_dates = []
    for days_ahead in range(31):
        check_date = today + timedelta(days=days_ahead)
        if check_date.weekday() == target_weekday:
            delivery_dates.append(check_date)
    
    if not delivery_dates or boxes_per_month <= 0:
        return []
    
    num_deliveries = len(delivery_dates)
    boxes_per_delivery = boxes_per_month // num_deliveries
    remainder = boxes_per_month % num_deliveries
    
    schedule = []
    for i, date in enumerate(delivery_dates):
        boxes = boxes_per_delivery + (1 if i < remainder else 0)
        schedule.append({
            'date': date.strftime('%Y-%m-%d'),
            'day': preferred_day,
            'boxes': boxes
        })
    
    return schedule

    
class Subscription(db.Model):
    """Subscription customers"""
    __tablename__ = 'subscriptions'
    
    id = db.Column(db.String(50), primary_key=True)
    invoiceNumber = db.Column('invoice_number', db.String(50), unique=True)
    name = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(100), nullable=False)
    phone = db.Column(db.String(20), default='')
    address = db.Column(db.String(200), default='')
    flatNo = db.Column('flat_no', db.String(50), default='')
    plan = db.Column(db.String(100), nullable=False)
    status = db.Column(db.String(50), nullable=False)
    startDate = db.Column('start_date', db.String(50), nullable=False)
    preferredDeliveryDay = db.Column('preferred_delivery_day', db.String(20), default='Any Day')
    boxesPerMonth = db.Column('boxes_per_month', db.Integer, default=1)
    
    # DO NOT add __init__ method!
    
    def to_dict(self):
        return {
            'id': self.id,
            'invoiceNumber': self.invoiceNumber,
            'name': self.name,
            'email': self.email,
            'phone': self.phone or '',
            'address': self.address or '',
            'flatNo': self.flatNo or '',
            'flatName': self.flatNo or '',
            'plan': self.plan,
            'status': self.status,
            'startDate': self.startDate,
            'preferredDeliveryDay': self.preferredDeliveryDay or 'Any Day',
            'boxesPerMonth': self.boxesPerMonth or 1
        }


class Sale(db.Model):
    """Retail sales"""
    __tablename__ = 'sales'
    
    id = db.Column(db.String(50), primary_key=True)
    invoiceNumber = db.Column('invoice_number', db.String(50), unique=True)
    customerName = db.Column('customer_name', db.String(100), nullable=False)
    products = db.Column(db.JSON)
    totalAmount = db.Column('total_amount', db.Float, nullable=False)
    date = db.Column(db.String(50), nullable=False)
    status = db.Column(db.String(50), nullable=False)
    warehouseId = db.Column('warehouse_id', db.String(50))  # ADD THIS LINE!

    def to_dict(self):
        products_list = []
        products_data = self.products or []
        
        for p in products_data:
            product_name = p.get('name', 'Unknown Product')
            
            # If no name but has productId, fetch it
            if product_name == 'Unknown Product' and p.get('productId'):
                product = Product.query.get(p.get('productId'))
                if product:
                    product_name = product.name
            
            products_list.append({
                'name': product_name,
                'quantity': p.get('quantity', 0),
                'price': p.get('price', 0)
            })
        
        return {
            'id': self.id,
            'invoiceNumber': self.invoiceNumber,
            'customerName': self.customerName,
            'date': self.date,
            'status': self.status,
            'totalAmount': self.totalAmount,
            'warehouseId': self.warehouseId,
            'products': products_list
        }
    

   
class WholesaleSale(db.Model):
    """Wholesale sales"""
    __tablename__ = 'wholesale_sales'
    
    id = db.Column(db.String(50), primary_key=True)
    invoiceNumber = db.Column('invoice_number', db.String(50), unique=True)
    shopName = db.Column('shop_name', db.String(100), nullable=False)
    contact = db.Column(db.String(100), default='')
    address = db.Column(db.String(200), default='')
    products = db.Column(db.JSON)
    totalAmount = db.Column('total_amount', db.Float, nullable=False)
    date = db.Column(db.String(50), nullable=False)
    status = db.Column(db.String(50), nullable=False)
    warehouseId = db.Column('warehouse_id', db.String(50))  # ADD THIS if missing!

    def to_dict(self):
        products_list = []
        products_data = self.products or []
        
        for p in products_data:
            product_name = p.get('name', 'Unknown Product')
            
            # If no name but has productId, fetch it
            if product_name == 'Unknown Product' and p.get('productId'):
                product = Product.query.get(p.get('productId'))
                if product:
                    product_name = product.name
            
            products_list.append({
                'name': product_name,
                'quantity': p.get('quantity', 0),
                'price': p.get('price', 0)
            })
        
        return {
            'id': self.id,
            'invoiceNumber': self.invoiceNumber,
            'shopName': self.shopName,
            'contact': self.contact or '',
            'address': self.address or '',
            'date': self.date,
            'status': self.status,
            'totalAmount': self.totalAmount,
            'warehouseId': self.warehouseId,
            'products': products_list
        }



class Expense(db.Model):
    """Business expenses"""
    __tablename__ = 'expenses'
    
    id = db.Column(db.String(50), primary_key=True)
    category = db.Column(db.String(100), nullable=False)
    description = db.Column(db.String(200), nullable=False)
    amount = db.Column(db.Float, nullable=False)
    date = db.Column(db.String(50), nullable=False)
    warehouse_id = db.Column(db.String(50), db.ForeignKey('warehouses.id'), nullable=False)
    def to_dict(self):
        return {
            'id': self.id,
            'category': self.category,
            'description': self.description,
            'amount': self.amount,
            'date': self.date,
            'warehouse_id': self.warehouse_id
        }

class Warehouse(db.Model):
    """Warehouse locations"""
    __tablename__ = 'warehouses'
    
    id = db.Column(db.String(50), primary_key=True)
    name = db.Column(db.String(100), nullable=False, unique=True)

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name
        }

class Inventory(db.Model):  # Or whatever it's called
    __tablename__ = 'inventory'
    
    id = db.Column(db.String(50), primary_key=True)
    productId = db.Column('product_id', db.String(50), nullable=False)
    warehouseId = db.Column('warehouse_id', db.String(50), nullable=False)
    quantity = db.Column(db.Integer, nullable=False)
    # restockLevel column doesn't exist!
    
    def to_dict(self):
        product = Product.query.get(self.productId)
        warehouse = Warehouse.query.get(self.warehouseId)
        
        return {
            'id': self.id,
            'productId': self.productId,
            'productName': product.name if product else 'Unknown',
            'warehouseId': self.warehouseId,
            'warehouseName': warehouse.name if warehouse else 'Unknown',
            'quantity': self.quantity
            # Removed restockLevel!
        }

def generate_random_string(length=6):
    """Generate a random lowercase alphanumeric string of given length."""
    chars = string.ascii_lowercase + string.digits
    return ''.join(random.choices(chars, k=length))
    
class SalesReturn(db.Model):
    __tablename__ = 'sales_returns'
    
    id = Column(UUID(as_uuid=True),
                primary_key=True,
                server_default=text("gen_random_uuid()"))
    sale_id = db.Column(db.String, nullable=False)
    returned_products = db.Column(db.JSON, nullable=False)
    date = db.Column(db.String, nullable=False)
    
    def to_dict(self):
        original_sale = Sale.query.get(self.sale_id) or WholesaleSale.query.get(self.sale_id)
        
        if original_sale:
            invoice_number = getattr(original_sale, 'invoiceNumber', 'Unknown')
            if hasattr(original_sale, 'customerName'):
                customer_name = original_sale.customerName
            else:
                customer_name = getattr(original_sale, 'shopName', 'Unknown')
            warehouse_id = getattr(original_sale, 'warehouseId', None)
        else:
            invoice_number = 'Unknown'
            customer_name = 'Unknown'
            warehouse_id = None
    
        # Calculate total refund amount
        total_refund = 0
        for p in self.returned_products:
            try:
                price = float(p.get('price', 0))
                quantity = int(p.get('quantity', 0))
                total_refund += price * quantity
            except (ValueError, TypeError):
                continue
        
        return {
            'id': self.id,
            'originalSaleId': self.sale_id,
            'originalInvoiceNumber': invoice_number,
            'customerName': customer_name,
            'warehouseId': warehouse_id,
            'returnedProducts': self.returned_products,
            'date': self.date,
            'totalRefundAmount': total_refund  # Pass calculated refund amount
        }
    



class InvoiceCounter(db.Model):
    """Invoice number counter"""
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

# --- INVOICE NUMBER GENERATION ---

def get_next_invoice_number(counter_type):
    """Generate sequential invoice numbers"""
    counter = InvoiceCounter.query.filter_by(counterType=counter_type).first()
    if not counter:
        counter = InvoiceCounter(
            id=generate_id('ic'),
            counterType=counter_type,
            currentNumber=0
        )
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

# --- INVENTORY MANAGEMENT ---

def update_inventory(product_id, warehouse_id, quantity_change):
    """Update inventory quantity (positive = add, negative = remove)"""
    try:
        inventory = Inventory.query.filter_by(
            productId=product_id,
            warehouseId=warehouse_id
        ).first()
        
        if not inventory:
            if quantity_change > 0:
                inventory = Inventory(
                    id=generate_id('inv'),
                    productId=product_id,
                    warehouseId=warehouse_id,
                    quantity=quantity_change
                )
                db.session.add(inventory)
            else:
                raise ValueError(f"Not enough stock for product {product_id}")
        else:
            inventory.quantity += quantity_change
            if inventory.quantity < 0:
                raise ValueError(f"Not enough stock for product {product_id}")
        
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        raise e

def check_stock_availability(products_list, warehouse_id):
    """Check if enough stock exists for products"""
    for product in products_list:
        product_id = product.get('productId')
        required_qty = product.get('quantity', 0)
        
        inventory = Inventory.query.filter_by(
            productId=product_id,
            warehouseId=warehouse_id
        ).first()
        
        available_qty = inventory.quantity if inventory else 0
        
        if required_qty > available_qty:
            return False, f"Not enough stock for {product_id}. Required: {required_qty}, Available: {available_qty}"
    
    return True, ""

@app.route('/api/inventory/<id>', methods=['PUT'])
def update_inventory_item(id):
    try:
        data = request.get_json()
        item = Inventory.query.get(id)  # Or InventoryItem
        
        if not item:
            return jsonify({'error': 'Inventory item not found'}), 404
        
        if 'quantity' in data:
            item.quantity = data['quantity']
        # Removed restockLevel line!
        
        db.session.commit()
        return jsonify(item.to_dict())
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@app.route('/api/inventory/<id>', methods=['DELETE'])
def delete_inventory_item(id):
    try:
        item = Inventory.query.get(id)  # ✅ Use your actual class name
        
        if not item:
            return jsonify({'error': 'Inventory item not found'}), 404
        
        db.session.delete(item)
        db.session.commit()
        return jsonify({'message': 'Deleted successfully'})
    except Exception as e:
        db.session.rollback()
        print(f"Error deleting inventory: {e}")  # Debug log
        return jsonify({'error': str(e)}), 500


# --- PRODUCTS API ---

@app.route('/api/products', methods=['GET'])
def get_products():
    """Get all products"""
    try:
        products = Product.query.all()
        return jsonify([p.to_dict() for p in products])
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/products', methods=['POST'])
def add_product():
    """Create new product"""
    try:
        data = request.get_json()
        product = Product(
            id=generate_id('prod'),
            name=data['name'],
            defaultPrice=data['defaultPrice'],
            unit=data.get('unit', 'kg')
        )
        db.session.add(product)
        db.session.commit()
        return jsonify(product.to_dict()), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@app.route('/api/products/<string:prod_id>', methods=['PUT'])
def update_product(prod_id):
    """Update existing product"""
    try:
        product = Product.query.get(prod_id)
        if not product:
            return jsonify({'error': 'Product not found'}), 404
        
        data = request.get_json()
        for key, value in data.items():
            if hasattr(product, key) and key != 'id':
                setattr(product, key, value)
        
        db.session.commit()
        return jsonify(product.to_dict())
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@app.route('/api/products/<string:prod_id>', methods=['DELETE'])
def delete_product(prod_id):
    """Delete product"""
    try:
        product = Product.query.get(prod_id)
        if not product:
            return jsonify({'error': 'Product not found'}), 404
        
        db.session.delete(product)
        db.session.commit()
        return '', 204
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

# --- SUBSCRIPTIONS API ---

@app.route('/api/subscriptions', methods=['GET', 'POST'])
def subscriptions():
    """Handle subscriptions - both GET and POST"""
    
    if request.method == 'GET':
        try:
            subs = Subscription.query.order_by(Subscription.id.desc()).all()
            return jsonify([s.to_dict() for s in subs])
        except Exception as e:  # ← YOU FORGOT THIS PART!
            return jsonify({'error': str(e)}), 500
    
    elif request.method == 'POST':
        try:
            data = request.get_json()
            
            if 'flatName' in data:
                if 'flatNo' not in data:
                    data['flatNo'] = data['flatName']
                data.pop('flatName')
            
            preferred_day = data.pop('preferredDeliveryDay', 'Any Day')
            boxes_per_month = data.pop('boxesPerMonth', 1)
            
            subscription = Subscription(
                id=generate_id('sub'),
                invoiceNumber=get_next_invoice_number('subscription'),
                name=data['name'],
                email=data['email'],
                phone=data.get('phone', ''),
                address=data.get('address', ''),
                flatNo=data.get('flatNo', ''),
                plan=data['plan'],
                status=data['status'],
                startDate=data['startDate'],
                preferredDeliveryDay=preferred_day,
                boxesPerMonth=boxes_per_month
            )
            
            db.session.add(subscription)
            db.session.commit()
            return jsonify(subscription.to_dict()), 201
            
        except Exception as e:
            db.session.rollback()
            return jsonify({'error': str(e)}), 500




@app.route('/api/subscriptions/<string:sub_id>', methods=['GET', 'PUT', 'DELETE'])
def subscription_detail(sub_id):
    """Handle individual subscription operations"""
    
    subscription = Subscription.query.get(sub_id)
    if not subscription:
        return jsonify({'error': 'Subscription not found'}), 404
    
    if request.method == 'GET':
        return jsonify(subscription.to_dict())
    
    elif request.method == 'PUT':
        try:
            data = request.get_json()
            
            if 'flatName' in data:
                if 'flatNo' not in data:
                    data['flatNo'] = data['flatName']
                data.pop('flatName')
            
            # Update all fields
            subscription.name = data.get('name', subscription.name)
            subscription.email = data.get('email', subscription.email)
            subscription.phone = data.get('phone', subscription.phone)
            subscription.address = data.get('address', subscription.address)
            subscription.flatNo = data.get('flatNo', subscription.flatNo)
            subscription.plan = data.get('plan', subscription.plan)
            subscription.status = data.get('status', subscription.status)
            subscription.startDate = data.get('startDate', subscription.startDate)
            subscription.preferredDeliveryDay = data.get('preferredDeliveryDay', subscription.preferredDeliveryDay)
            subscription.boxesPerMonth = data.get('boxesPerMonth', subscription.boxesPerMonth)
            
            db.session.commit()
            return jsonify(subscription.to_dict())
            
        except Exception as e:
            db.session.rollback()
            return jsonify({'error': str(e)}), 500
    
    elif request.method == 'DELETE':
        try:
            db.session.delete(subscription)
            db.session.commit()
            return jsonify({'message': 'Subscription deleted'}), 200
        except Exception as e:
            db.session.rollback()
            return jsonify({'error': str(e)}), 500




@app.route('/api/stock-prep', methods=['GET'])
def get_stock_prep():
    try:
        # Calculate IST time from UTC
        utc_now = datetime.utcnow()
        ist_now = utc_now + timedelta(hours=5, minutes=30)
        today = ist_now.replace(hour=0, minute=0, second=0, microsecond=0)
        tomorrow = today + timedelta(days=1)
        today_str = today.strftime('%Y-%m-%d')
        tomorrow_str = tomorrow.strftime('%Y-%m-%d')
        today_day = today.strftime('%A')
        tomorrow_day = tomorrow.strftime('%A')

        print(f"[DEBUG] UTC time: {utc_now.strftime('%Y-%m-%d %H:%M')}")
        print(f"[DEBUG] IST time: {ist_now.strftime('%Y-%m-%d %H:%M')}")
        print(f"[DEBUG] Using IST for 'today': {today_str}, 'tomorrow': {tomorrow_str}")

        # --- Subscriptions (active) ---
        subs = Subscription.query.filter_by(status='Active').all()
        print(f"[DEBUG] Active subscriptions fetched: {len(subs)}")

        # --- Retail Sales (today/tomorrow) ---
        retail_sales = Sale.query.filter(
            Sale.date.in_([today_str, tomorrow_str])
        ).all()
        print(f"[DEBUG] Retail sales fetched: {len(retail_sales)}")

        # --- Wholesale Sales (today/tomorrow) ---
        wholesale_sales = WholesaleSale.query.filter(
            WholesaleSale.date.in_([today_str, tomorrow_str])
        ).all()
        print(f"[DEBUG] Wholesale sales fetched: {len(wholesale_sales)}")

        # Prepare delivery lists
        today_deliveries = []
        tomorrow_deliveries = []

        # Process subscriptions (assuming you have calculate_delivery_schedule)
        for sub in subs:
            boxes_per_month = getattr(sub, 'boxesPerMonth', 1) or 1
            preferred_day = getattr(sub, 'preferredDeliveryDay', 'Any Day') or 'Any Day'
            schedule = calculate_delivery_schedule(
                sub.startDate,
                preferred_day,
                boxes_per_month
            )
            for delivery in schedule:
                delivery_date = delivery['date']
                delivery_obj = {
                    'type': 'Subscription',
                    'id': sub.id,
                    'customerName': sub.name,
                    'address': getattr(sub, 'address', ''),
                    'flatNo': getattr(sub, 'flatNo', ''),
                    'phone': getattr(sub, 'phone', ''),
                    'boxes': delivery['boxes'],
                    'plan': getattr(sub, 'plan', ''),
                    'deliveryDate': delivery_date
                }
                if delivery_date == today_str:
                    today_deliveries.append(delivery_obj)
                elif delivery_date == tomorrow_str:
                    tomorrow_deliveries.append(delivery_obj)

        # Process retail sales
        for sale in retail_sales:
            delivery_obj = {
                'type': 'Retail',
                'id': sale.id,
                'customerName': getattr(sale, 'customerName', ''),
                'address': getattr(sale, 'address', ''),
                'phone': getattr(sale, 'phone', ''),
                'products': getattr(sale, 'products', []),
                'deliveryDate': sale.date
            }
            if sale.date == today_str:
                today_deliveries.append(delivery_obj)
            elif sale.date == tomorrow_str:
                tomorrow_deliveries.append(delivery_obj)

        # Process wholesale sales
        for wsale in wholesale_sales:
            delivery_obj = {
                'type': 'Wholesale',
                'id': wsale.id,
                'customerName': getattr(wsale, 'shopName', ''),
                'address': getattr(wsale, 'address', ''),
                'phone': getattr(wsale, 'contact', ''),
                'products': getattr(wsale, 'products', []),
                'deliveryDate': wsale.date
            }
            if wsale.date == today_str:
                today_deliveries.append(delivery_obj)
            elif wsale.date == tomorrow_str:
                tomorrow_deliveries.append(delivery_obj)

        total_today = sum(d.get('boxes', sum(p.get('quantity', 0) for p in d.get('products', []))) for d in today_deliveries)
        total_tomorrow = sum(d.get('boxes', sum(p.get('quantity', 0) for p in d.get('products', []))) for d in tomorrow_deliveries)

        response_data = {
            'dateRange': {
                'today': today_str,
                'tomorrow': tomorrow_str
            },
            'today': {
                'date': today_str,
                'day': today_day,
                'deliveries': today_deliveries,
                'totalBoxes': total_today,
                'breakdown': {
                    'subscriptions': sum(1 for d in today_deliveries if d['type'] == 'Subscription'),
                    'retail': sum(1 for d in today_deliveries if d['type'] == 'Retail'),
                    'wholesale': sum(1 for d in today_deliveries if d['type'] == 'Wholesale'),
                }
            },
            'tomorrow': {
                'date': tomorrow_str,
                'day': tomorrow_day,
                'deliveries': tomorrow_deliveries,
                'totalBoxes': total_tomorrow,
                'breakdown': {
                    'subscriptions': sum(1 for d in tomorrow_deliveries if d['type'] == 'Subscription'),
                    'retail': sum(1 for d in tomorrow_deliveries if d['type'] == 'Retail'),
                    'wholesale': sum(1 for d in tomorrow_deliveries if d['type'] == 'Wholesale'),
                }
            }
        }

        print(f"[DEBUG] Stock prep completed successfully.")
        return jsonify(response_data), 200

    except Exception as e:
        print(f"[ERROR] Stock prep failed: {e}")
        return jsonify({'error': str(e)}), 500
# --- SALES API ---

@app.route('/api/sales', methods=['GET'])
def get_sales():
    """Get all retail sales"""
    try:
        sales = Sale.query.all()
        return jsonify([s.to_dict() for s in sales])
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/sales', methods=['POST'])
def add_sale():
    """Create new retail sale"""
    try:
        data = request.get_json()
        warehouse_id = data.get('warehouseId')
        if not warehouse_id:
            return jsonify({'error': 'Valid warehouseId is required'}), 400
            
        products_in_sale = data.get('products', [])
        if not products_in_sale:
            return jsonify({'error': 'No products provided for sale'}), 400

        # Check stock availability
        is_available, message = check_stock_availability(products_in_sale, warehouse_id)
        if not is_available:
            return jsonify({'error': message}), 400

        # Deduct inventory
        for p in products_in_sale:
            update_inventory(p['productId'], warehouse_id, -p['quantity'])

        # Create sale record
        sale = Sale(
            id=generate_id('sale'),
            invoiceNumber=get_next_invoice_number('sale'),
            customerName=data['customerName'],
            products=products_in_sale,
            totalAmount=data['totalAmount'],
            date=data['date'],
            status=data['status'],
            warehouseId=data.get('warehouseId')
        )

        db.session.add(sale)

        # ✅ Handle Free Sample as Expense
        if sale.status == 'Free':
            expense_desc = f"Free sample - Invoice {sale.invoiceNumber}"
            free_expense = Expense(
                id=generate_id('expense'),    
                category='FREE_SAMPLES',
                description=expense_desc,
                amount=abs(sale.totalAmount or 0),
                date=sale.date,
                warehouse_id=sale.warehouseId
            )
            db.session.add(free_expense)

        db.session.commit()
        return jsonify(sale.to_dict()), 201

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


def check_stock_availability(products_list, warehouse_id):
    """Check if enough stock exists for products"""
    for product in products_list:
        product_id = product.get('productId')
        required_qty = product.get('quantity', 0)

        inventory = Inventory.query.filter_by(
            productId=product_id,
            warehouseId=warehouse_id
        ).first()

        available_qty = inventory.quantity if inventory else 0

        if required_qty > available_qty:
            return False, f"Not enough stock for {product_id}. Required: {required_qty}, Available: {available_qty}"

    return True, ""

@app.route('/api/sales/<sale_id>', methods=['PUT'])
def update_sale_endpoint(sale_id):
    try:
        data = request.get_json() or {}

        sale = Sale.query.get(sale_id)
        if not sale:
            return jsonify({'error': 'Sale not found'}), 404

        # ----- BASIC FIELDS (same as before, only slightly safer for date) -----
        sale.customerName = data.get('customerName', sale.customerName)

        # date comes as "YYYY-MM-DD" from frontend; keep existing if not sent
        if 'date' in data and data['date']:
            try:
                sale.date = datetime.strptime(data['date'], '%Y-%m-%d').date()
            except ValueError:
                # If your column is a string, you can just store it as is
                sale.date = data['date']

        sale.status      = data.get('status', sale.status)
        sale.warehouseId = data.get('warehouseId', sale.warehouseId)

        # ✅ update products & totalAmount only if passed
        if 'products' in data:
            sale.products = data['products']
        if 'totalAmount' in data:
            sale.totalAmount = data['totalAmount']

        # ----- NEW: sync FREE sample to Expenses table -----
        # We'll identify the linked expense by description + category
        expense_desc = f"Free sample - Invoice {sale.invoiceNumber}"
        free_expense = Expense.query.filter_by(
            category='FREE_SAMPLES',      # make sure this exists in your Enum
            description=expense_desc
        ).first()

        if sale.status == 'Free':
            # If sale is FREE, ensure an expense exists & is correct
            amount = abs(sale.totalAmount or 0)

            if free_expense:
                free_expense.amount       = amount
                free_expense.date         = sale.date
                free_expense.warehouse_id = sale.warehouseId
            else:
                new_exp = Expense(
                    category='FREE_SAMPLES',
                    description=expense_desc,
                    amount=amount,
                    date=sale.date,
                    warehouse_id=sale.warehouseId
                )
                db.session.add(new_exp)
        else:
            # If sale is NOT free anymore, delete existing FREE_SAMPLES expense
            if free_expense:
                db.session.delete(free_expense)
        # ----- END NEW -----

        db.session.commit()
        return jsonify(sale.to_dict())
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500




@app.route('/api/sales/<string:sale_id>', methods=['DELETE'])
def delete_sale(sale_id):
    """Delete retail sale and restore inventory"""
    try:
        sale = Sale.query.get(sale_id)
        if not sale:
            return jsonify({'error': 'Sale not found'}), 404

        # ✅ use the sale's own warehouseId
        warehouse_id = sale.warehouseId
        if not warehouse_id:
            return jsonify({'error': 'Sale has no warehouseId set'}), 400

        # Restore inventory back to that warehouse
        for p in sale.products or []:
            # assumes p has productId & quantity
            update_inventory(p['productId'], warehouse_id, p['quantity'])

        # ----- NEW: delete linked FREE_SAMPLES expense, if any -----
        expense_desc = f"Free sample - Invoice {sale.invoiceNumber}"
        free_expense = Expense.query.filter_by(
            category='FREE_SAMPLES',
            description=expense_desc
        ).first()
        if free_expense:
            db.session.delete(free_expense)
        # ----- END NEW -----

        db.session.delete(sale)
        db.session.commit()
        return '', 204
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500



@app.route('/api/expenses/import-csv', methods=['POST'])
def import_expenses_csv():
    """
    Expected columns in CSV (header row):

    date,category,description,amount,warehouse

    - date: YYYY-MM-DD
    - category: e.g. 'Rent', 'Fuel', etc.
    - description: free text
    - amount: number
    - warehouse: warehouse NAME exactly as in DB (e.g. 'Mangalapuram')
    """
    if 'file' not in request.files:
        return jsonify({'created': 0, 'errors': [{'row': 0, 'message': 'No file uploaded'}]}), 400

    file = request.files['file']
    if file.filename == '':
        return jsonify({'created': 0, 'errors': [{'row': 0, 'message': 'Empty filename'}]}), 400

    content = file.read().decode('utf-8')
    reader = csv.DictReader(StringIO(content))

    required_cols = {'date', 'category', 'description', 'amount'}
    header = set(reader.fieldnames or [])
    missing = required_cols - header
    if missing:
        return jsonify({
            'created': 0,
            'errors': [{
                'row': 0,
                'message': f"Missing required columns: {', '.join(sorted(missing))}"
            }]
        }), 400

    # Optional warehouse column – map by name if present
    warehouses_by_name = {w.name.strip().lower(): w for w in Warehouse.query.all()}

    created = 0
    errors = []
    row_num = 1  # header is row 1 visually

    for row in reader:
        row_num += 1
        try:
            date_str = (row.get('date') or '').strip()
            category = (row.get('category') or '').strip()
            description = (row.get('description') or '').strip()
            amount_str = (row.get('amount') or '').strip()
            warehouse_name = (row.get('warehouse') or '').strip().lower()

            if not (date_str and category and description and amount_str):
                errors.append({'row': row_num, 'message': 'Missing required fields (date/category/description/amount).'})
                continue

            try:
                amount = float(amount_str)
            except ValueError:
                errors.append({'row': row_num, 'message': f"Invalid amount '{amount_str}'."})
                continue

            if not warehouse_name:
                errors.append({'row': row_num, 'message': "Missing 'warehouse' name."})
                continue

            wh = warehouses_by_name.get(warehouse_name)
            if not wh:
                errors.append({'row': row_num, 'message': f"Warehouse '{row.get('warehouse')}' not found."})
                continue

            exp = Expense(
                id=generate_id('exp'),
                category=category,
                description=description,
                amount=amount,
                date=date_str,
                warehouse_id=wh.id
            )
            db.session.add(exp)
            created += 1

        except Exception as e:
            errors.append({'row': row_num, 'message': f'Unexpected error: {str(e)}'})

    db.session.commit()
    return jsonify({'created': created, 'errors': errors})



# --- WHOLESALE SALES API ---

@app.route('/api/wholesale-sales', methods=['GET'])
def get_wholesale_sales():
    """Get all wholesale sales"""
    try:
        sales = WholesaleSale.query.all()
        return jsonify([s.to_dict() for s in sales])
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/wholesale-sales', methods=['POST'])
def add_wholesale_sale():
    """Create new wholesale sale"""
    try:
        data = request.get_json()
        warehouse_id = data.get('warehouseId', 'default')
        products_in_sale = data.get('products', [])
        
        # Check stock availability
        is_available, message = check_stock_availability(products_in_sale, warehouse_id)
        if not is_available:
            return jsonify({'error': message}), 400
        
        # Deduct inventory
        for p in products_in_sale:
            update_inventory(p['productId'], warehouse_id, -p['quantity'])
        
        # Create sale record
        sale = WholesaleSale(
            id=generate_id('wsale'),
            invoiceNumber=get_next_invoice_number('wholesale_sale'),
            shopName=data['shopName'],
            contact=data.get('contact', ''),
            address=data.get('address', ''),
            products=products_in_sale,
            totalAmount=data['totalAmount'],
            date=data['date'],
            status=data['status'],
            warehouseId = data.get('warehouseId')
        )
        db.session.add(sale)
        db.session.commit()
        return jsonify(sale.to_dict()), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@app.route('/api/wholesale-sales/<sale_id>', methods=['PUT'])
def update_wholesale_sale_endpoint(sale_id):
    try:
        data = request.get_json() or {}

        wsale = WholesaleSale.query.get(sale_id)
        if not wsale:
            return jsonify({'error': 'Wholesale sale not found'}), 404

        wsale.shopName = data.get('shopName', wsale.shopName)
        wsale.contact = data.get('contact', wsale.contact)
        wsale.address = data.get('address', wsale.address)
        wsale.date = data.get('date', wsale.date)
        wsale.status = data.get('status', wsale.status)
        wsale.warehouseId = data.get('warehouseId', wsale.warehouseId)

        if 'products' in data:
            wsale.products = data['products']
        if 'totalAmount' in data:
            wsale.totalAmount = data['totalAmount']

        db.session.commit()
        return jsonify(wsale.to_dict())
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@app.route('/api/wholesale-sales/<string:sale_id>', methods=['DELETE'])
def delete_wholesale_sale(sale_id):
    """Delete wholesale sale and restore inventory"""
    try:
        sale = WholesaleSale.query.get(sale_id)
        if not sale:
            return jsonify({'error': 'Wholesale sale not found'}), 404
        
        warehouse_id = sale.warehouseId
        if not warehouse_id:
            return jsonify({'error': 'Sale has no warehouseId set'}), 400
        
        # Restore inventory
        for p in sale.products or []:
            update_inventory(p['productId'], warehouse_id, p['quantity'])
        
        db.session.delete(sale)
        db.session.commit()
        return '', 204
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

# --- EXPENSES API ---

@app.route('/api/expenses', methods=['GET'])
def get_expenses():
    """Get all expenses"""
    try:
        expenses = Expense.query.all()
        return jsonify([e.to_dict() for e in expenses])
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/expenses', methods=['POST'])
def add_expense():
    """Create new expense"""
    try:
        data = request.get_json()
        expense = Expense(
            id=generate_id('exp'),
            category=data['category'],
            description=data['description'],
            amount=data['amount'],
            date=data['date'],
            warehouse_id=data['warehouse_id']  # Save warehouse_id
        )
        db.session.add(expense)
        db.session.commit()
        return jsonify(expense.to_dict()), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@app.route('/api/expenses/<string:expense_id>', methods=['PUT'])
def update_expense(expense_id):
    try:
        expense = Expense.query.get(expense_id)
        if not expense:
            return jsonify({'error': 'Expense not found'}), 404

        data = request.get_json() or {}

        expense.category = data.get('category', expense.category)
        expense.description = data.get('description', expense.description)
        expense.amount = data.get('amount', expense.amount)
        expense.date = data.get('date', expense.date)

        # Optional warehouse change
        if 'warehouse_id' in data:
            expense.warehouse_id = data['warehouse_id']

        db.session.commit()
        return jsonify(expense.to_dict())
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@app.route('/api/expenses/<string:exp_id>', methods=['DELETE'])
def delete_expense(exp_id):
    """Delete expense"""
    try:
        expense = Expense.query.get(exp_id)
        if not expense:
            return jsonify({'error': 'Expense not found'}), 404
        
        db.session.delete(expense)
        db.session.commit()
        return '', 204
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


#-----csv expense---
@app.route('/api/expenses/import-csv', methods=['POST'])
def import_expenses_from_csv():
    """
    Bulk import expenses from a CSV file.

    Expected columns (header row required):
    date, category, description, amount, warehouse_id
    """
    try:
        if 'file' not in request.files:
            return jsonify({'error': 'CSV file is required with field name "file"'}), 400

        file = request.files['file']
        if file.filename == '':
            return jsonify({'error': 'No selected file'}), 400

        # Read CSV content
        stream = io.StringIO(file.stream.read().decode('utf-8'))
        reader = csv.DictReader(stream)

        created = 0
        errors = []

        for idx, row in enumerate(reader, start=2):  # Start at 2 (header is row 1)
            try:
                date = row.get('date', '').strip()
                category = row.get('category', '').strip()
                description = row.get('description', '').strip()
                amount_str = row.get('amount', '').strip()
                warehouse_id = row.get('warehouse_id', '').strip()

                # Basic validation
                if not (date and category and description and amount_str and warehouse_id):
                    raise ValueError('Missing required fields (date/category/description/amount/warehouse_id)')

                amount = float(amount_str)

                expense = Expense(
                    id=generate_id('exp'),
                    category=category,
                    description=description,
                    amount=amount,
                    date=date,
                    warehouse_id=warehouse_id
                )
                db.session.add(expense)
                created += 1

            except Exception as row_err:
                errors.append(f'Row {idx}: {str(row_err)}')

        db.session.commit()

        return jsonify({
            'message': 'Expenses import completed',
            'created': created,
            'errors': errors
        }), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


# --- WAREHOUSES API ---

@app.route('/api/warehouses', methods=['GET'])
def get_warehouses():
    """Get all warehouses"""
    try:
        warehouses = Warehouse.query.all()
        return jsonify([w.to_dict() for w in warehouses])
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/warehouses', methods=['POST'])
def add_warehouse():
    """Create new warehouse"""
    try:
        data = request.get_json()
        warehouse = Warehouse(
            id=generate_id('wh'),
            name=data['name']
        )
        db.session.add(warehouse)
        db.session.commit()
        return jsonify(warehouse.to_dict()), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@app.route('/api/warehouses/<string:wh_id>', methods=['PUT'])
def update_warehouse(wh_id):
    """Update warehouse"""
    try:
        warehouse = Warehouse.query.get(wh_id)
        if not warehouse:
            return jsonify({'error': 'Warehouse not found'}), 404
        
        data = request.get_json()
        warehouse.name = data['name']
        db.session.commit()
        return jsonify(warehouse.to_dict())
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@app.route('/api/warehouses/<string:wh_id>', methods=['DELETE'])
def delete_warehouse(wh_id):
    """Delete warehouse (only if empty)"""
    try:
        inventory_items = Inventory.query.filter_by(warehouseId=wh_id).all()
        if any(item.quantity > 0 for item in inventory_items):
            return jsonify({'error': 'Cannot delete warehouse with stock'}), 400
        
        warehouse = Warehouse.query.get(wh_id)
        if warehouse:
            db.session.delete(warehouse)
            db.session.commit()
        return '', 204
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

# --- INVENTORY API ---

@app.route('/api/inventory', methods=['GET'])
def get_inventory():
    """Get all inventory with product/warehouse names"""
    try:
        inventory = Inventory.query.all()
        products = {p.id: p for p in Product.query.all()}
        warehouses = {w.id: w for w in Warehouse.query.all()}
        
        enriched = []
        for item in inventory:
            enriched_item = item.to_dict()
            enriched_item['productName'] = products[item.productId].name if item.productId in products else 'Unknown'
            enriched_item['warehouseName'] = warehouses[item.warehouseId].name if item.warehouseId in warehouses else 'Unknown'
            enriched.append(enriched_item)
        
        return jsonify(enriched)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/inventory/stock', methods=['POST'])
def add_inventory_stock():
    """Add stock to inventory"""
    try:
        data = request.get_json()
        inventory = Inventory.query.filter_by(
            productId=data['productId'],
            warehouseId=data['warehouseId']
        ).first()
        
        if not inventory:
            inventory = Inventory(
                id=generate_id('inv'),
                productId=data['productId'],
                warehouseId=data['warehouseId'],
                quantity=data['quantity']
            )
            db.session.add(inventory)
        else:
            inventory.quantity += data['quantity']
        
        db.session.commit()
        return jsonify(inventory.to_dict()), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

# --- SALES RETURNS API ---

@app.route('/api/sales-returns', methods=['GET'])
def get_sales_returns():
    """Get all sales returns with derived data"""
    try:
        returns = SalesReturn.query.all()
        return jsonify([r.to_dict() for r in returns])
    except Exception as e:
        print(f"❌ Error getting sales returns: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@app.route('/api/sales-returns', methods=['POST'])
def add_sales_return():
    try:
        data = request.json
        
        # Validate that the sale exists
        original_sale = Sale.query.get(data.get('saleId')) or WholesaleSale.query.get(data.get('saleId'))
        
        if not original_sale:
            return jsonify({'error': 'Original sale not found'}), 404
        
        # Only save fields that exist in database: id, sale_id, returned_products, date
        sales_return = SalesReturn(
            sale_id=data['saleId'],
            returned_products=data['returnedProducts'],  # Must include {productId, name, quantity, price}
            date=data['date']
        )
        
        db.session.add(sales_return)
        db.session.commit()
        
        return jsonify({'success': True, 'id': sales_return.id})
        
    except Exception as e:
        print(f"❌ Error adding sales return: {str(e)}")
        import traceback
        traceback.print_exc()
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


# --- AGGREGATED DATA APIs ---

@app.route('/api/dashboard-stats', methods=['GET'])
def get_dashboard_stats():
    try:
        current_month_sales = [s for s in Sale.query.all() if is_current_month(s.date)]
        current_month_wholesale = [ws for ws in WholesaleSale.query.all() if is_current_month(ws.date)]
        current_month_expenses = [e for e in Expense.query.all() if is_current_month(e.date)]

        # ✅ Split sales: paid vs free/loss
        retail_paid = [s for s in current_month_sales if s.status != 'Free' and not getattr(s, 'isLoss', False)]
        wholesale_paid = [ws for ws in current_month_wholesale if ws.status != 'Free' and not getattr(ws, 'isLoss', False)]

        retail_free = [s for s in current_month_sales if s.status == 'Free' or getattr(s, 'isLoss', False)]
        wholesale_free = [ws for ws in current_month_wholesale if ws.status == 'Free' or getattr(ws, 'isLoss', False)]

        # ✅ Sales = only PAID amounts
        total_paid_retail = sum(s.totalAmount for s in retail_paid)
        total_paid_wholesale = sum(ws.totalAmount for ws in wholesale_paid)
        total_sales = total_paid_retail + total_paid_wholesale

        # ✅ Free samples: treat as EXPENSE (take absolute value)
        free_sample_expense = sum(
            abs(s.totalAmount)
            for s in (retail_free + wholesale_free)
        )

        # ✅ Normal expenses from Expense table
        normal_expenses = sum(e.amount for e in current_month_expenses)

        # ✅ Total expenses = normal + free samples
        total_expenses = normal_expenses + free_sample_expense

        # ✅ Profit = paid sales - (normal expenses + free samples)
        net_profit = total_sales - total_expenses

        # ✅ Per-day sales: only paid orders
        sales_by_day = {}
        for s in retail_paid:
            day = datetime.strptime(s.date, '%Y-%m-%d').day
            if day not in sales_by_day:
                sales_by_day[day] = {'sales': 0, 'retailOrders': 0, 'wholesaleOrders': 0}
            sales_by_day[day]['sales'] += s.totalAmount
            sales_by_day[day]['retailOrders'] += 1

        for ws in wholesale_paid:
            day = datetime.strptime(ws.date, '%Y-%m-%d').day
            if day not in sales_by_day:
                sales_by_day[day] = {'sales': 0, 'retailOrders': 0, 'wholesaleOrders': 0}
            sales_by_day[day]['sales'] += ws.totalAmount
            sales_by_day[day]['wholesaleOrders'] += 1

        # ✅ Expense breakdown (only normal expenses in category split)
        expense_breakdown = {}
        for e in current_month_expenses:
            cat = e.category
            expense_breakdown[cat] = expense_breakdown.get(cat, 0) + e.amount

        stats = {
            'currentMonthSales': total_sales,                      # only paid
            'currentMonthRetailSales': total_paid_retail,          # only paid retail
            'currentMonthWholesaleSales': total_paid_wholesale,    # only paid wholesale

            'currentMonthExpenses': total_expenses,                # includes free sample
            'currentMonthNormalExpenses': normal_expenses,         # optional
            'freeSampleAsExpense': free_sample_expense,            # optional

            'currentMonthProfit': net_profit,

            'activeSubscriptions': len(
                [s for s in Subscription.query.all() if s.status == 'Active']
            ),

            'salesByDay': [
                {'day': d, **data}
                for d, data in sales_by_day.items()
            ],
            'expenseBreakdown': [
                {'name': name, 'value': value}
                for name, value in expense_breakdown.items()
            ],
        }

        return jsonify(stats), 200

    except Exception as e:
        print("Error generating dashboard stats:", e)
        return jsonify({'error': 'Failed to generate dashboard stats'}), 500


@app.route('/api/customers', methods=['GET'])
def get_customers():
    """Get aggregated customer data from all sources"""
    try:
        customers_map = {}
        
        def get_customer_key(name, phone):
            return f"{name.lower().strip()}-{phone.strip()}"
        
        # Aggregate from subscriptions
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
        
        # Aggregate from retail sales
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
        
        # Aggregate from wholesale sales
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
        
        # Format output
        customer_list = list(customers_map.values())
        for customer in customer_list:
            customer['types'] = list(customer['types'])
            customer['transactionHistory'].sort(key=lambda t: t.get('date') or t.get('startDate'), reverse=True)
        
        return jsonify(customer_list)
    except Exception as e:
        return jsonify({'error': str(e)}), 500



# --- HEALTH CHECK ---

@app.route('/api/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({'status': 'OK', 'message': 'Backend is running'}), 200

# --- ERROR HANDLERS ---

@app.errorhandler(404)
def not_found(error):
    return jsonify({'error': 'Not found'}), 404

@app.errorhandler(500)
def internal_error(error):
    db.session.rollback()
    return jsonify({'error': 'Internal server error'}), 500

# --- DATABASE INITIALIZATION ---

def init_db():
    """Initialize database tables"""
    with app.app_context():
        db.create_all()
        print("✓ Database tables created/verified")

# --- RUN APPLICATION ---

if __name__ == '__main__':
    init_db()
    app.run(debug=True, port=5001, host='0.0.0.0')















































































