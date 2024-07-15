const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const express = require("express");
require("dotenv").config();
const cors = require("cors");
const jwt = require("jsonwebtoken");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const app = express();

const port = process.env.PORT || 5000;

//middleware
app.use(express.json());
app.use(cors());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.0zrlznh.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    // Get the database and collection on which to run the operation
    const database = client.db("bisterDB");
    const menuCollection = database.collection("menu");
    const reviewsCollection = database.collection("reviews");
    const addtoCartCollection = database.collection("addtoCart");
    const usersCollection = database.collection("users");
    const paymentCollection = database.collection("payments");

    //genate a secret key require('crypto').randomBytes(64).toString('hex')

    //custom middleware

    //verify token
    const verify = (req, res, next) => {
      if (!req.headers.authorization) {
        return res.status(401).send({ message: "forbidden" });
      }
      // verify a token symmetric
      const token = req.headers.authorization.split(" ")[1];
      jwt.verify(token, process.env.ACESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
          return res.status(401).send({ message: "forbidden" });
        }
        req.decoded = decoded;
        next();
      });
    };
    //verify admin
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded?.user?.email;
      const query = { email: email };
      const result = await usersCollection.findOne(query);
      if (result?.role === "admin") {
        next();
      } else {
        return res.status(401).send({ message: "forbidden" });
      }
    };

    //jwt related api methods

    app.post("/jwt", async (req, res) => {
      const user = req.body;
      const token = jwt.sign(
        {
          user,
        },
        process.env.ACESS_TOKEN_SECRET,
        { expiresIn: "1h" }
      );
      res.send({ token });
    });

    //user related api methods

    app.post("/users", async (req, res) => {
      const user = req.body;
      const query = { email: user.email };
      const findUser = await usersCollection.find(query).toArray();
      if (findUser.length < 1) {
        const result = await usersCollection.insertOne(user);
        res.send(result);
      }
    });
    //check admin for layout
    app.get("/users/admim/:email", async (req, res) => {
      const query = { email: req.params.email };
      const result = await usersCollection.find(query).toArray();
      const isAdmin = result.find((user) => user.role === "admin");
      isAdmin ? res.send(true) : res.send(false);
    });
    app.get("/users", verify, verifyAdmin, async (req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result);
    });
    app.patch("/users/:id", verify, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await usersCollection.updateOne(query, { $set: req.body });
      res.send(result);
    });
    app.delete("/users/:id", verify, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await usersCollection.deleteOne(query);
      res.send(result);
    });

    // Get the database

    app.get("/menu", async (req, res) => {
      const result = await menuCollection.find().toArray();
      res.send(result);
    });

    app.get("/menu/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await menuCollection.find(query).toArray();
      res.send(result);
    });

    app.post("/menu", verify, verifyAdmin, async (req, res) => {
      const menu = req.body;
      const result = await menuCollection.insertOne(menu);
      res.send(result);
    });

    app.patch("/menu/:id", verify, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const item = req.body;
      const query = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          name: item.name,
          category: item.category,
          price: parseInt(item.price),
          recipe: item.recipe,
        },
      };
      const result = await menuCollection.updateOne(query, updateDoc);
      res.send(result);
    });

    app.delete("/menu/:id", verify, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await menuCollection.deleteOne(query);
      res.send(result);
    });
    app.get("/reviews", async (req, res) => {
      const result = await reviewsCollection.find().toArray();
      res.send(result);
    });

    app.get("/addtoCart", async (req, res) => {
      const queryEmail = req.query.email;
      const query = { email: queryEmail };
      const result = await addtoCartCollection.find(query).toArray();
      res.send(result);
    });
    app.post("/addtoCart", async (req, res) => {
      const result = await addtoCartCollection.insertOne(req.body);
      res.send(result);
    });

    app.delete("/addtoCart/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await addtoCartCollection.deleteOne(query);
      res.send(result);
    });

    // Payment method intent
    app.post("/create-payment-intent", verify, async (req, res) => {
      const { price } = req.body;
      const amount = parseInt(price * 100);
      const minimumAmount = 1; // Minimum amount in cents (corresponds to $0.50 USD)
      if (amount < minimumAmount) {
        return res
          .status(400)
          .send({ message: "Amount is below minimum charge amount." });
      }
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ["card"], // Correct parameter name
      });
      res.send({ clientSecret: paymentIntent.client_secret });
    });

    // Payment method intent
    // app.post("/create-payment-intent", async (req, res) => {
    //   const { price } = req.body;
    //   const amount = parseInt(price * 100); // Convert price to cents
    //   const minimumAmount = 10; // Minimum amount in cents (corresponds to $0.50 USD)

    //   if (amount < minimumAmount) {
    //     return res.status(400).send({ error: 'Amount is below minimum charge amount.' });
    //   }

    //   try {
    //     const paymentIntent = await stripe.paymentIntents.create({
    //       amount: amount,
    //       currency: "usd",
    //       payment_method_types: ["card"],
    //     });
    //     res.send({ clientSecret: paymentIntent.client_secret });
    //   } catch (err) {
    //     console.error("Error creating payment intent:", err);
    //     res.status(500).send({ error: 'Failed to create payment intent.' });
    //   }
    // });

    app.post("/payment", verify, async (req, res) => {
      const paymentInfo = req.body;
      const result = await paymentCollection.insertOne(paymentInfo);
      const query = {
        _id: {
          $in: paymentInfo.addtocardsId.map((id) => new ObjectId(id)),
        },
      };
      const resultDelete = await addtoCartCollection.deleteMany(query);
      res.send({ result, resultDelete });
    });

    app.get("/payment-history/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const result = await paymentCollection.find(query).toArray();
      res.send(result);
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

//route
app.get("/", (req, res) => {
  res.send("bistro boss running");
});

app.listen(port, () => {
  console.log(`app listening on port ${port}`);
});
