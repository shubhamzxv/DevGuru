# Interview questions actually asked

Real questions from Python backend interviews. Every one must be answered inside a topic
(in its "Interview questions" block). The syllabus in Step 3 must contain a home for each.

| #   | Question (cleaned up)                                                             | Track               | Topic it belongs to                                                           |
| --- | --------------------------------------------------------------------------------- | ------------------- | ----------------------------------------------------------------------------- |
| 1   | How many microservices have you developed? (experience question)                  | System Design (new) | Monolith vs microservices: how to talk about your own work                    |
| 2   | Difference between monolithic and microservices, and how do services communicate? | System Design (new) | Monolith vs microservices; Service communication (REST, gRPC, message queues) |
| 3   | Lambda function in Python                                                         | Python              | Lambda functions                                                              |
| 4   | How will you optimize a query?                                                    | SQL                 | Query optimization                                                            |
| 5   | What is SQL query profiling?                                                      | SQL                 | Query profiling (new topic)                                                   |
| 6   | Multiprocessing vs multithreading                                                 | Python              | Concurrency: threads, processes and the GIL (new topic)                       |
| 7   | Dependency injection in FastAPI                                                   | FastAPI             | Dependency injection (Depends)                                                |
| 8   | Difference between EXPLAIN and EXPLAIN ANALYZE                                    | SQL                 | EXPLAIN vs EXPLAIN ANALYZE (new topic)                                        |
| 9   | Difference between list and tuple                                                 | Python              | Tuples (list vs tuple)                                                        |
| 10  | Difference between == and is                                                      | Python              | Memory model and mutability (also answered in Variables)                      |
| 11  | Difference between * and ** (*args and **kwargs)                                  | Python              | *args and **kwargs                                                            |
| 12  | Difference between shallow copy and deep copy                                     | Python              | Shallow copy vs deep copy (new topic)                                         |
| 13  | Difference between decorator and generator                                        | Python              | Decorators; Generators (comparison in both)                                   |
| 14  | asyncio                                                                           | Python              | async / await and asyncio                                                     |
| 15  | How does memory management work in Python?                                        | Python              | Memory management: reference counting and garbage collection (new topic)      |
| 16  | What is Redis cache?                                                              | System Design (new) | Caching with Redis                                                            |
| 17  | What is indexing in MySQL?                                                        | SQL                 | Indexes (with MySQL notes: B-tree, composite, covering index)                 |

## What this changes in the plan

- **Python** gets four topics the original list did not name: concurrency (threads vs
  processes vs asyncio), shallow vs deep copy, memory management, and a clear list-vs-tuple
  comparison.
- **SQL** gets "EXPLAIN vs EXPLAIN ANALYZE" and "Query profiling". The playground engine is
  SQLite, which only has `EXPLAIN QUERY PLAN`, so these topics show real MySQL and PostgreSQL
  output as examples and use SQLite for the hands-on part.
- **11th track: "System Design Basics" (approved)** for questions 1, 2 and 16 (monolith vs
  microservices, service communication, caching with Redis, message queues).

Add new questions to the table as they come up.
