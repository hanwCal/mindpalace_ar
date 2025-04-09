start backend:
    cd backend
    pip install -r requirements.txt  # install (run only once)
    uvicorn api:app --reload

start frontend:
    cd frontend
    npm install  # install (run only once)
    npm start

