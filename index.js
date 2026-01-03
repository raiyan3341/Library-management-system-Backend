const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 5000;


app.use(cors({
    origin: [
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:5175", 
        "https://your-frontend-project.vercel.app" // আপনার আসল ফ্রন্টএন্ড লিঙ্ক এখানে দিন
    ],
    credentials: true
}));
app.use(express.json());

const user = process.env.DB_USER;
const pass = process.env.DB_PASS;
const dbName = process.env.DB_NAME;

const uri = `mongodb+srv://${user}:${pass}@cluster0.dddbozq.mongodb.net/${dbName}?retryWrites=true&w=majority`;

mongoose.connect(uri)
    .then(() => console.log("✅ MongoDB Connected"))
    .catch(err => console.error("❌ Connection Error:", err));

// Models
const Book = mongoose.model('Book', new mongoose.Schema({
    title: String, author: String, category: String, image: String,
    rating: Number, totalCopies: Number, availableCopies: Number, description: String
}));

const BorrowRecord = mongoose.model('BorrowRecord', new mongoose.Schema({
    bookId: { type: mongoose.Schema.Types.ObjectId, ref: 'Book' },
    userEmail: String, userName: String,
    issueDate: { type: Date, default: Date.now },
    dueDate: Date, returnDate: { type: Date, default: null }, fine: { type: Number, default: 0 }
}));

app.get("/", (req, res) => {
    res.send("Library Server is Running...");
});

app.get('/api/book/:id', async (req, res) => {
    try {
        const book = await Book.findById(req.params.id);
        if (!book) return res.status(404).send({ message: "Book not found" });
        res.send(book);
    } catch (err) {
        res.status(500).send(err.message);
    }
});

app.get('/api/books', async (req, res) => {
    try {
        const books = await Book.find({});
        res.send(books);
    } catch (err) {
        res.status(500).send({ message: "বই লোড করতে সমস্যা হয়েছে", error: err.message });
    }
});

app.get('/api/borrowed-books', async (req, res) => {
    try {
        const email = req.query.email;
        const records = await BorrowRecord.find({ userEmail: email }).populate('bookId');
        res.send(records);
    } catch (err) {
        res.status(500).send(err.message);
    }
});


app.get('/api/users/admin/:email', async (req, res) => {
    const email = req.params.email;
    const isAdmin = email === 'admin@library.com'; 
    res.send({ admin: isAdmin });
});


app.get('/api/admin-stats', async (req, res) => {
    try {
        const totalBooks = await Book.countDocuments();
        const totalBorrowed = await BorrowRecord.countDocuments();
        const totalMembers = 12; 

        res.send({ totalBooks, totalBorrowed, totalMembers });
    } catch (err) {
        res.status(500).send(err.message);
    }
});


app.post('/api/add-book', async (req, res) => {
    try {
        const newBook = new Book(req.body);
        const result = await newBook.save();
        res.send(result);
    } catch (err) {
        res.status(500).send(err.message);
    }
});


app.delete('/api/books/:id', async (req, res) => {
    try {
        const result = await Book.findByIdAndDelete(req.params.id);
        if (!result) {
            return res.status(404).send({ message: "Book not found" });
        }

        res.send({ deletedCount: 1 }); 
    } catch (err) {
        res.status(500).send({ message: err.message });
    }
});




app.post('/api/issue-book', async (req, res) => {
    try {
        const { bookId, userEmail, userName, days } = req.body;
        const book = await Book.findById(bookId);
        
        if (!book) return res.status(404).send({ message: "Book not found" });
        if (book.availableCopies <= 0) return res.status(400).send({ message: "Out of Stock" });

        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + (parseInt(days) || 7)); // Default to 7 days if invalid

        const record = new BorrowRecord({ bookId, userEmail, userName, dueDate });
        await record.save();

        await Book.findByIdAndUpdate(bookId, { $inc: { availableCopies: -1 } });
        res.send({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).send({ message: "Internal Server Error", error: err.message });
    }
});

app.post('/api/return-book', async (req, res) => {
    try {
        const { recordId, bookId } = req.body;

        await BorrowRecord.findByIdAndDelete(recordId);

        await Book.findByIdAndUpdate(bookId, { $inc: { availableCopies: 1 } });

        res.send({ success: true, message: "Book returned successfully" });
    } catch (err) {
        res.status(500).send({ message: "Failed to return book", error: err.message });
    }
});
app.get('/api/my-borrowed/:email', async (req, res) => {
    const result = await BorrowRecord.find({ userEmail: req.params.email, returnDate: null }).populate('bookId');
    res.send(result);
});

app.listen(port, () => console.log(`🚀 Running on ${port}`));
module.exports = app;