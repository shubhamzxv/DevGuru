-- DevGuru sample database (SQLite).
-- Loaded into the browser for the SQL playground. "Reset database" runs this file again.
-- Built for teaching: one department has no employees, some employees have no department,
-- one customer has no orders, one product was never ordered, and some salaries are tied.

PRAGMA foreign_keys = ON;

DROP TABLE IF EXISTS order_items;
DROP TABLE IF EXISTS orders;
DROP TABLE IF EXISTS products;
DROP TABLE IF EXISTS customers;
DROP TABLE IF EXISTS employees;
DROP TABLE IF EXISTS departments;

CREATE TABLE departments (
  id        INTEGER PRIMARY KEY,
  name      TEXT NOT NULL UNIQUE,
  location  TEXT NOT NULL
);

CREATE TABLE employees (
  id             INTEGER PRIMARY KEY,
  name           TEXT NOT NULL,
  department_id  INTEGER REFERENCES departments (id),
  manager_id     INTEGER REFERENCES employees (id),
  salary         INTEGER NOT NULL CHECK (salary > 0),
  hire_date      TEXT NOT NULL,
  city           TEXT NOT NULL
);

CREATE TABLE customers (
  id         INTEGER PRIMARY KEY,
  name       TEXT NOT NULL,
  city       TEXT NOT NULL,
  email      TEXT UNIQUE,
  joined_on  TEXT NOT NULL
);

CREATE TABLE products (
  id        INTEGER PRIMARY KEY,
  name      TEXT NOT NULL,
  category  TEXT NOT NULL,
  price     REAL NOT NULL CHECK (price >= 0),
  stock     INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE orders (
  id           INTEGER PRIMARY KEY,
  customer_id  INTEGER NOT NULL REFERENCES customers (id),
  order_date   TEXT NOT NULL,
  status       TEXT NOT NULL CHECK (status IN ('placed', 'shipped', 'delivered', 'cancelled'))
);

CREATE TABLE order_items (
  id          INTEGER PRIMARY KEY,
  order_id    INTEGER NOT NULL REFERENCES orders (id),
  product_id  INTEGER NOT NULL REFERENCES products (id),
  quantity    INTEGER NOT NULL CHECK (quantity > 0),
  unit_price  REAL NOT NULL
);

INSERT INTO departments (id, name, location) VALUES
  (1, 'Engineering', 'Bengaluru'),
  (2, 'Sales',       'Mumbai'),
  (3, 'Marketing',   'Delhi'),
  (4, 'Finance',     'Mumbai'),
  (5, 'Support',     'Pune'),
  (6, 'Research',    'Hyderabad');   -- no employees yet

INSERT INTO employees (id, name, department_id, manager_id, salary, hire_date, city) VALUES
  (1,  'Anita Rao',      1,    NULL, 185000, '2016-04-11', 'Bengaluru'),   -- head of Engineering
  (2,  'Vikram Shah',    2,    NULL, 150000, '2017-01-23', 'Mumbai'),      -- head of Sales
  (3,  'Meera Nair',     3,    NULL, 120000, '2018-06-04', 'Delhi'),       -- head of Marketing
  (4,  'Rohit Verma',    1,    1,    140000, '2018-09-17', 'Bengaluru'),
  (5,  'Asha Kulkarni',  1,    1,    140000, '2019-02-01', 'Pune'),        -- same salary as Rohit
  (6,  'Kabir Singh',    1,    4,     95000, '2020-07-13', 'Bengaluru'),
  (7,  'Neha Gupta',     1,    4,     88000, '2021-03-22', 'Delhi'),
  (8,  'Arjun Mehta',    1,    5,     72000, '2022-08-08', 'Pune'),
  (9,  'Sana Khan',      1,    5,     72000, '2023-01-16', 'Hyderabad'),   -- same salary as Arjun
  (10, 'Ravi Kumar',     2,    2,     82000, '2019-11-05', 'Mumbai'),
  (11, 'Priya Iyer',     2,    2,     78000, '2020-02-19', 'Chennai'),
  (12, 'Imran Ali',      2,    10,    56000, '2022-05-30', 'Mumbai'),
  (13, 'Divya Menon',    2,    10,    54000, '2023-06-12', 'Kochi'),
  (14, 'Suresh Patil',   3,    3,     68000, '2020-10-01', 'Delhi'),
  (15, 'Tanvi Joshi',    3,    3,     61000, '2022-01-10', 'Pune'),
  (16, 'Farah Sheikh',   4,    NULL, 130000, '2017-08-21', 'Mumbai'),      -- head of Finance
  (17, 'Gaurav Bose',    4,    16,    76000, '2021-09-06', 'Kolkata'),
  (18, 'Lakshmi Pillai', 5,    NULL,  64000, '2019-05-27', 'Pune'),        -- head of Support
  (19, 'Manoj Yadav',    5,    18,    42000, '2023-03-03', 'Pune'),
  (20, 'Zoya Fernandes', NULL, NULL,  50000, '2024-02-12', 'Goa'),         -- not placed in a department yet
  (21, 'Nikhil Das',     NULL, 1,     58000, '2024-07-01', 'Bengaluru');   -- intern, no department

INSERT INTO customers (id, name, city, email, joined_on) VALUES
  (1,  'Aarav Sharma',   'Delhi',     'aarav@example.com',   '2023-01-15'),
  (2,  'Isha Patel',     'Ahmedabad', 'isha@example.com',    '2023-02-20'),
  (3,  'Rahul Reddy',    'Hyderabad', 'rahul@example.com',   '2023-03-05'),
  (4,  'Sneha Kapoor',   'Mumbai',    'sneha@example.com',   '2023-04-18'),
  (5,  'Karan Malhotra', 'Delhi',     'karan@example.com',   '2023-06-09'),
  (6,  'Pooja Desai',    'Pune',      'pooja@example.com',   '2023-08-25'),
  (7,  'Aditya Ghosh',   'Kolkata',   NULL,                  '2023-10-02'),   -- no email given
  (8,  'Nisha Thomas',   'Kochi',     'nisha@example.com',   '2024-01-11'),
  (9,  'Varun Saxena',   'Mumbai',    'varun@example.com',   '2024-03-07'),
  (10, 'Ritu Agarwal',   'Jaipur',    'ritu@example.com',    '2024-05-19');   -- has not ordered yet

INSERT INTO products (id, name, category, price, stock) VALUES
  (1,  'Wireless Mouse',      'Electronics', 599.00,  120),
  (2,  'Mechanical Keyboard', 'Electronics', 2499.00, 45),
  (3,  'USB-C Cable',         'Electronics', 299.00,  300),
  (4,  'Bluetooth Speaker',   'Electronics', 1899.00, 0),     -- out of stock
  (5,  'Notebook A5',         'Stationery',  80.00,   500),
  (6,  'Gel Pen Pack',        'Stationery',  120.00,  260),
  (7,  'Desk Organizer',      'Stationery',  450.00,  75),
  (8,  'Cotton T-Shirt',      'Clothing',    499.00,  150),
  (9,  'Running Shoes',       'Clothing',    2999.00, 30),
  (10, 'Steel Water Bottle',  'Home',        650.00,  90),
  (11, 'Table Lamp',          'Home',        1250.00, 20),
  (12, 'Yoga Mat',            'Home',        899.00,  60);    -- never ordered

INSERT INTO orders (id, customer_id, order_date, status) VALUES
  (1,  1, '2024-01-05', 'delivered'),
  (2,  2, '2024-01-12', 'delivered'),
  (3,  1, '2024-02-03', 'delivered'),
  (4,  3, '2024-02-14', 'cancelled'),
  (5,  4, '2024-02-28', 'delivered'),
  (6,  5, '2024-03-09', 'delivered'),
  (7,  2, '2024-03-21', 'delivered'),
  (8,  6, '2024-04-02', 'shipped'),
  (9,  1, '2024-04-15', 'delivered'),
  (10, 7, '2024-04-27', 'delivered'),
  (11, 8, '2024-05-06', 'shipped'),
  (12, 4, '2024-05-18', 'placed'),
  (13, 9, '2024-05-30', 'delivered'),
  (14, 3, '2024-06-08', 'placed'),
  (15, 5, '2024-06-20', 'cancelled'),
  (16, 2, '2024-06-29', 'placed');

INSERT INTO order_items (id, order_id, product_id, quantity, unit_price) VALUES
  (1,  1,  1,  1, 599.00),
  (2,  1,  3,  2, 299.00),
  (3,  2,  2,  1, 2499.00),
  (4,  3,  5,  10, 80.00),
  (5,  3,  6,  3, 120.00),
  (6,  4,  9,  1, 2999.00),
  (7,  5,  8,  2, 499.00),
  (8,  5,  10, 1, 650.00),
  (9,  6,  4,  1, 1899.00),
  (10, 6,  3,  1, 299.00),
  (11, 7,  7,  2, 450.00),
  (12, 7,  5,  5, 80.00),
  (13, 8,  11, 1, 1250.00),
  (14, 9,  2,  1, 2399.00),    -- bought at a discount
  (15, 9,  1,  2, 599.00),
  (16, 10, 6,  4, 120.00),
  (17, 11, 9,  1, 2999.00),
  (18, 11, 8,  1, 499.00),
  (19, 12, 10, 3, 650.00),
  (20, 13, 1,  1, 599.00),
  (21, 13, 11, 1, 1250.00),
  (22, 13, 3,  3, 299.00),
  (23, 14, 2,  2, 2499.00),
  (24, 15, 4,  1, 1899.00),
  (25, 16, 7,  1, 450.00),
  (26, 16, 8,  3, 499.00);
