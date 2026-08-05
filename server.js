const express = require ('express');
const app = express();

app.use(express.json());

const port = 3000;

const {z} = require('zod');

const productSchema = z.object({
    name: z.string().min(2, 'Product name must be at least 2 characters long'),
    price: z.number().positive('Product price must be a positive number'),
});

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

app.post('/products',(req, res) => {
    const result = productSchema.safeParse(req.body);

    if (!result.success) {
        return res.status(400).json({ message: 'Validation failed', errors: result.error.issues.map(issue => issue.message) });
    }

    const { name, price } = result.data;

    const newProduct = {name, price};
    res.status(201).json({ message:'Product created', product: newProduct});
});

app.get('/search',(req, res) =>{
    const category = req.query.category;
    const sort = req.query.sort;
    res.send(`Searching category: ${category}, sorted by: ${sort}`);
})
 
app.listen(port, () => {
    console.log(`server is running on port ${port}`);
});