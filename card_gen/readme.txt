start backend:
    cd backend
    pip install -r requirements.txt  # install (run only once)
    uvicorn main:app --reload

start frontend:
    cd frontend
    npm install  # install (run only once)
    npm start

