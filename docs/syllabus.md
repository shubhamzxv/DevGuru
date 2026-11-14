# DevGuru syllabus

Generated from the index.json files. Topic ids are `<track>-<slug>`.
11 tracks, 365 topics.

## 1. Python (64 topics)

1. **Getting started**: What is Python?; Syntax and indentation; Variables; Data types; Numbers and operators; Input and output (print, input); Type conversion
2. **Strings**: Strings; String methods; String formatting (f-strings)
3. **Collections**: Lists; List methods and slicing; Tuples; List vs tuple; Sets; Dictionaries; Comprehensions
4. **Control flow**: Conditions (if, elif, else); for loops; while loops; break, continue and pass; match-case
5. **Functions**: Functions; Arguments and default values; *args and **kwargs; Lambda functions; Scope and closures (LEGB); map, filter and reduce
6. **Modules and files**: Modules and imports; Packages, pip and virtual environments; File handling; Working with JSON and CSV; Python + SQL (sqlite3)
7. **Errors**: Exceptions (try, except, finally); Raising and custom exceptions
8. **Object-oriented programming**: Classes and objects; **init** and self; Instance, class and static methods; Inheritance; Polymorphism; Encapsulation and @property; Dunder (magic) methods; Abstract classes (ABC)
9. **Advanced Python**: Iterators; Generators; Decorators; Decorator vs generator; Context managers (with); Type hints (typing); Dataclasses
10. **Memory and internals**: Mutable vs immutable; == vs is; Shallow copy vs deep copy; Memory management (reference counting, garbage collection); The GIL
11. **Concurrency**: Multithreading; Multiprocessing; Multithreading vs multiprocessing; async / await; asyncio in practice
12. **Best practices**: PEP 8 and clean code; Logging; Testing with pytest; Python interview revision

## 2. SQL (58 topics)

1. **Database basics**: What is a database?; Tables, rows and columns; Data types; SQL vs NoSQL; SQLite vs MySQL vs PostgreSQL
2. **Reading data**: SELECT; WHERE; AND, OR, NOT, IN, BETWEEN, LIKE; NULL values; ORDER BY; LIMIT and OFFSET; DISTINCT; CASE expressions
3. **Functions**: String functions; Number and date functions; Aggregate functions (COUNT, SUM, AVG, MIN, MAX)
4. **Grouping**: GROUP BY; HAVING; WHERE vs HAVING
5. **Joins**: How JOINs work; INNER JOIN; LEFT JOIN; RIGHT and FULL JOIN; SELF JOIN; CROSS JOIN; UNION and UNION ALL
6. **Advanced queries**: Subqueries; Correlated subqueries; EXISTS vs IN; CTEs (WITH); Recursive CTEs; Window functions; ROW_NUMBER, RANK and DENSE_RANK; LAG, LEAD and running totals
7. **Changing data**: INSERT; UPDATE; DELETE; DELETE vs TRUNCATE vs DROP; CREATE and ALTER TABLE
8. **Database design**: Constraints; Primary and foreign keys; Relationships (one-to-one, one-to-many, many-to-many); Normalization
9. **Performance**: Indexes; Indexing in MySQL; Reading a query plan (EXPLAIN); EXPLAIN vs EXPLAIN ANALYZE; Query profiling; Query optimization
10. **Transactions and more**: Transactions and ACID; Isolation levels and locks; Views; Stored procedures and triggers (overview)
11. **Interview queries**: 2nd and Nth highest salary; Find and delete duplicates; Top N per group; Employees earning more than their manager; SQL interview revision

## 3. Django (37 topics)

1. **Basics**: What is Django?; MVT architecture; Project vs app; Settings; How a request flows through Django
2. **Models and ORM**: Models; Fields and relationships; Migrations; ORM queries (filter, get, exclude); Q and F objects; aggregate and annotate; select_related vs prefetch_related (N+1 problem); Managers and QuerySets
3. **Views, URLs and templates**: URLs; Function-based views (FBV); Class-based views (CBV); Templates; Static and media files
4. **Forms and admin**: Forms and ModelForms; Admin
5. **Auth and internals**: Authentication (users, login, logout); Permissions and groups; Sessions and cookies; Middleware; Signals
6. **Django REST Framework**: What is Django REST Framework?; Serializers; APIView and generic views; ViewSets and routers; Authentication and permissions in DRF; Pagination and filtering
7. **Production**: Caching in Django; Background tasks with Celery (overview); Testing Django apps; Security (CSRF, XSS, SQL injection); Deployment basics (Gunicorn, Nginx, env vars); Django interview revision

## 4. FastAPI (23 topics)

1. **Basics**: What is FastAPI?; First app and Uvicorn; Path parameters; Query parameters; Request body
2. **Pydantic and responses**: Pydantic models; Validation; Response models; Status codes and HTTPException
3. **Dependency injection**: Dependency injection (Depends); Sub-dependencies, yield and database sessions
4. **Async and background work**: async def vs def routes; Background tasks; Middleware and CORS
5. **Structure and data**: APIRouter and project structure; Database with SQLAlchemy
6. **Security**: Authentication basics (OAuth2 password flow); JWT tokens
7. **Docs, testing and deployment**: OpenAPI docs (Swagger UI); Testing with TestClient; Deployment basics; FastAPI vs Django; FastAPI interview revision

## 5. REST APIs & HTTP (28 topics)

1. **How the web works**: Client and server; HTTP request and response; URLs, endpoints and resources; HTTP vs HTTPS
2. **HTTP details**: HTTP methods; Status codes; Headers; JSON; Query params vs request body
3. **REST API design**: REST principles; Naming resources; Idempotency and safe methods; PUT vs PATCH; Pagination; Filtering and sorting; Versioning; Error responses
4. **Security**: API keys; Sessions vs tokens; JWT; OAuth 2.0 basics; CORS; Rate limiting
5. **Beyond the basics**: HTTP caching (ETag, Cache-Control); Webhooks; REST vs GraphQL vs gRPC; Testing APIs (curl, Postman); REST and HTTP interview revision

## 6. AWS (31 topics)

1. **Cloud basics**: What is cloud computing?; Regions and Availability Zones; Shared responsibility model; Pricing basics and the free tier
2. **Security and access**: IAM users, groups and policies; IAM roles
3. **Compute**: EC2; Security groups and key pairs; Load balancers and Auto Scaling; Lambda; Containers on AWS (ECS, Fargate) overview
4. **Storage**: S3; S3 permissions, versioning and lifecycle; EBS and EFS
5. **Databases**: RDS; DynamoDB; ElastiCache (Redis)
6. **Networking and delivery**: VPC basics (subnets, route tables, gateways); Route 53; CloudFront; API Gateway
7. **Messaging and monitoring**: SQS; SNS; SQS vs SNS vs EventBridge; CloudWatch
8. **Deploying and architectures**: Amplify Hosting; Infrastructure as code (CloudFormation, CDK); Static site (S3 + CloudFront); Serverless API (API Gateway + Lambda + DynamoDB); Three-tier web app; AWS interview revision

## 7. Git & GitHub (29 topics)

1. **Basics**: What is Git?; Install and configure; git init; Working directory, staging area, repository; add and commit; status, log and diff; .gitignore
2. **Branching**: Branches; Merge; Merge conflicts; Rebase; Merge vs rebase; Stash; Cherry-pick
3. **Undoing things**: restore and commit --amend; Reset; Revert; Reset vs revert; Reflog
4. **Remotes and GitHub**: Remotes; push, pull and fetch; fetch vs pull; GitHub: repositories, forks and clones; Pull requests; Tags and releases
5. **Workflows**: Workflows (feature branch, Git Flow, trunk-based); Good commit messages; GitHub Actions basics; Git interview revision

## 8. Docker (20 topics)

1. **Basics**: What is Docker?; Containers vs virtual machines; Your first container (docker run); Images and containers
2. **Building images**: Dockerfile; Layers and build cache; CMD vs ENTRYPOINT; Multi-stage builds; Docker Hub and registries
3. **Running containers**: Container commands (ps, stop, rm, logs, exec); Ports; Volumes; Networks; Environment variables
4. **Docker Compose**: docker-compose; Compose example: Django + PostgreSQL + Redis
5. **Production**: Best practices; Smaller, safer images; Docker vs Kubernetes (overview); Docker interview revision

## 9. Linux & Bash (25 topics)

1. **Basics**: What is Linux?; The file system (/, /home, /etc); Navigation (pwd, ls, cd); Files and folders (touch, mkdir, cp, mv, rm); Viewing files (cat, less, head, tail); Editing files (nano, vim basics)
2. **Permissions and users**: Permissions (chmod, chown); Users and groups; sudo
3. **Processes and system**: Processes (ps, top, kill); Services (systemctl); Disk and memory (df, du, free)
4. **Text power tools**: Pipes and redirection; grep; find; sed, awk, cut, sort, uniq
5. **Environment and network**: Environment variables; Installing software (apt, yum); Networking (curl, ping, ports); SSH and scp
6. **Shell scripting**: Your first shell script; Variables, if and loops in Bash; Functions and exit codes; cron jobs; Linux interview revision

## 10. DSA in Python (28 topics)

1. **Foundations**: Big-O notation; Time vs space complexity
2. **Arrays, strings and hashing**: Arrays and lists; Strings; Hashing (dict and set); Two pointers; Sliding window; Prefix sum
3. **Stacks, queues and linked lists**: Stacks; Queues and deque; Linked lists
4. **Recursion, sorting and searching**: Recursion; Backtracking basics; Bubble, selection and insertion sort; Merge sort; Quick sort; Binary search
5. **Trees and graphs**: Binary trees; Tree traversals; Binary search trees; Heaps and priority queues; Graphs; Breadth-first search (BFS); Depth-first search (DFS)
6. **Problem-solving patterns**: Dynamic programming basics; Greedy basics; Common interview patterns; Top interview problems

## 11. System Design Basics (22 topics)

1. **Foundations**: What is system design?; Scalability (vertical vs horizontal); Latency, throughput and availability; Load balancing
2. **Architecture**: Monolith vs microservices; How microservices communicate (REST, gRPC, queues); API gateway; Message queues (Kafka, RabbitMQ, SQS); Event-driven architecture
3. **Data and caching**: Choosing a database (SQL vs NoSQL); Caching basics; Redis cache; Cache strategies and invalidation; Replication and sharding; CAP theorem
4. **Reliability**: Rate limiting; Retries, timeouts and circuit breakers; Logging, monitoring and tracing
5. **Interview practice**: How to explain your own microservices; Design a URL shortener; Design a notification system; System design interview revision
