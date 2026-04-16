import mysql.connector


def get_db():
    return mysql.connector.connect(
        host="localhost",
        user="root",
        password="Charan@1689",
        database="student-data-management"
    )
