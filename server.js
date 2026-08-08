require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const {PrismaPg} = require('@prisma/adapter-pg');

const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL,
});
const prisma = new PrismaClient( {adapter});


const express = require ('express');
const app = express();

app.use(express.json());

const port = 3000;

const {z} = require('zod');

const bcrypt = require('bcrypt');


const registerSchema = z.object({
    email: z.string().email('Must be a valid email address'),
    password: z.string().min(6, 'Password must be at least 6 characters long'),
});

const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 3000; //

const productSchema = z.object({
    name: z.string().min(2, 'Product name must be at least 2 characters long'),
    price: z.number().positive('Product price must be a positive number'),
});

function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ message: 'Access token required' });
    }

    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) {
            return res.status(403).json({ message: 'Invalid or expired token' });
        }
        req.user = decoded;
        next();
    });
}

app.get('/',(req, res) => {
    res.send('Welcome to the homepage');
});

app.get('/about',(req, res) => {
    res.send('This is the about page.');
});

app.get('/products/:id',(req, res) => {
    const productId = req.params.id;
    res.json({id: productId, name:'Sample Product'});
});

app.get('/profile', authenticateToken, (req, res) => {
    res.json({ message: 'This is your profile', user: req.user });
});

app.post('/products' , authenticateToken,async(req, res) => {
    const result = productSchema.safeParse(req.body);

    if (!result.success) {
        return res.status(400).json({
             message: 'Validation failed', 
             errors: result.error.issues.map(issue => issue.message) 
            });
    }

    const newProduct = await prisma.product.create({
        data: {
            name: result.data.name,
            price: result.data.price,
            ownerId: req.user.userId,
        },
    });
    res.status(201).json({ message:'Product created', product: newProduct});
});

app.delete('/products/:id',authenticateToken, async(req, res) => {
    const productId = parseInt(req.params.id);

    const product =await prisma.product.findUnique({ where: { id: productId } });

    if (!product){
        return res.status(404).json({message:'product not found'});
    }
    if (product.ownerId !== req.user.userId){
        return res.status(403).json({message:'you do not have permission to delete this product'})
    }
    await prisma.product.delete({ where: { id: productId } });

    res.status(200).json({message:'Product deleted successfully'});
});

app.get('/search',(req, res) =>{
    const category = req.query.category;
    const sort = req.query.sort;
    res.send(`Searching category: ${category}, sorted by: ${sort}`);
});

//Registration route with validation and password hashing
app.post('/register', async (req, res) => {
    const result = registerSchema.safeParse(req.body);

    if (!result.success) {
        return res.status(400).json({ message: 'Validation failed', errors: result.error.issues.map(issue => issue.message) });
    }

    const { email, password } = result.data;
    // Check if user already exists
    const existingUser = await prisma.user.findUnique({ where: { email } });
    // Check if user already exists
    if (existingUser) {
        return res.status(409).json({ message: 'A user with this email already exists' });
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create new user
    const newUser = await prisma.user.create({
        data: {
            email,
            password: hashedPassword
        }
    });

    res.status(201).json({ message: 'User registered successfully', userId: newUser.id });
});

//login route with JWT token generation
const loginSchema = z.object({
    email: z.string().email('Must be a valid email address'),
    password: z.string().min(6, 'Password must be at least 6 characters long'),
});

app.post('/login', async (req, res) => {
    const result = loginSchema.safeParse(req.body);

    if (!result.success) {
        return res.status(400).json({ message: 'Validation failed', errors: result.error.issues.map(issue => issue.message) });
    }

    const { email, password } = result.data;

    // Find the user
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
        return res.status(401).json({ message: 'Invalid email or password' });
    }
    // Check the password
    const passwordMatches = await bcrypt.compare(password, user.password);

    if (!passwordMatches) {
        return res.status(401).json({ message: 'Invalid email or password' });
    }

    // Generate a JWT token
    const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: '1h' });

    res.status(200).json({ message: 'Login successful', token });
});


app.listen(port, () => {
    console.log(`server is running on port ${port}`);
});