const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const bodyParser = require('body-parser')
const crypto = require('crypto')
require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const { RtcTokenBuilder, RtmTokenBuilder, RtcRole, RtmRole } = require('agora-access-token')
const SSLCommerzPayment = require('sslcommerz')
const stripe = require("stripe")('sk_test_51L1c26AQe13D7JV445RLBZTVrVHrVl6aC4EeaLlsTVOGhvgwxoh5YxiRKKYzrcozo7mvFdLRrR0uwiU3CAeRLe8800O5amBNFk');
// const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const port = process.env.PORT || 5000;
const doctors = require("./routes/doctors");

const doctor = require("./routes/doctor");
const nurse = require('./routes/nurse')
const staff = require('./routes/staff')
const ambulance = require("./routes/ambulance");
const pharmacy = require("./routes/pharmacy");
const lab = require("./routes/lab");
const ambooking = require("./routes/ambooking");
const medicine = require("./routes/Medicine")
const blogs = require("./routes/blogs");
const booking = require("./routes/booking");
const hospitaldoctors = require("./routes/hospitaldoctors");
const news = require("./routes/news");
const hospitaldoctorsbooking = require("./routes/hospitaldoctorsbooking")
// const available = require("./routes/available");
const app = express();
// 
// middlewares
app.use(cors());
app.use(express.json());

//use the doctor.js file to 
//endpoints that start with /doctors
app.use("/doctors", doctors);
app.use("/doctor", doctor);
app.use("/nurse", nurse);
app.use("/staff", staff);
app.use("/hospitaldoctors", hospitaldoctors);
app.use("/pharmacy", pharmacy);
app.use("/lab", lab);
app.use("/blogs", blogs);
app.use("/bookingdoctors", booking);
app.use("/news", news);
app.use("/hospitaldoctorsbooking", hospitaldoctorsbooking);
app.use("/ambulance", ambulance);
app.use("/medicine", medicine);
app.use("/ambooking", ambooking);
// app.use("/available" , available);
app.use("/medicine", medicine);
// Video call feature with agora io
const nocache = (req, resp, next) => {
  resp.header('Cache-Control', 'private, no-cache, no-store, must-revalidate');
  resp.header('Expires', '-1');
  resp.header('Pragma', 'no-cache');
  next();
};
const generateAccessToken = async (req, resp) => {
  resp.header('Access-Control-Allow-Origin', '*');
  const channelName = req.query.channelName;

  const uid = Math.floor(Math.random() * 100000);
  const role = RtcRole.PUBLISHER;
  const APP_ID = "dd59321650a748728c748a7eb21637ff";
  const APP_CERTIFICATE = "2e670a5f42124586a8eef124d09b7fe4";
  const expirationTimeInSeconds = 3600
  const currentTimestamp = Math.floor(Date.now() / 1000)
  const privilegeExpiredTs = currentTimestamp + expirationTimeInSeconds;
  console.log("time", privilegeExpiredTs)
  console.log("role", role);
  console.log("name", channelName)
  const token = RtcTokenBuilder.buildTokenWithUid(APP_ID, APP_CERTIFICATE, channelName, 0, role);
  // -----------------Token posting to database-----------------
  const hospitaldoctorsbookingCollection = client.db(process.env.DB).collection('hospitaldoctorsbooking');
  let appointment = await hospitaldoctorsbookingCollection.findOne({ _id: ObjectId(req.params.id) });
  appointment = { ...appointment, token: token, channelName: channelName }
  console.log("appointment when creating video call", appointment)
  let updateAppointment = await hospitaldoctorsbookingCollection.updateOne({ _id: ObjectId(req.query.id) }, { $set: appointment });
  console.log(updateAppointment);
  return resp.json({ 'token': token });
};

app.get('/get-token', nocache, generateAccessToken);

app.get('/get-tokenPatient', async (req, res) => {
  const hospitaldoctorsbookingCollection = client.db(process.env.DB).collection('hospitaldoctorsbooking');
  const id = req.query.id;
  const appointment = await hospitaldoctorsbookingCollection.findOne({ _id: ObjectId(id) });
  console.log(appointment);
  res.send(appointment);
})

// Payment Integration through stripe
// This is your test secret API key.
app.post("/create-payment-intent", async (req, res) => {
  const { id } = req.body;
  const hospitaldoctorsbookingCollection = client.db(process.env.DB).collection('hospitaldoctorsbooking');
  const query = { _id: ObjectId(id) };
  const service = await hospitaldoctorsbookingCollection.findOne(query);
  // Create a PaymentIntent with the order amount and currency
  console.log("service?.fees", service?.fees)
  const paymentIntent = await stripe.paymentIntents.create({
    amount: service?.fees * 100,
    currency: "usd",
    automatic_payment_methods: {
      enabled: true,
    },
  });
  res.send({
    clientSecret: paymentIntent.client_secret,
  });
});
app.put("/updatepayment", async (req, res) => {
  const { serviceId, paymentStatus } = req.body;
  const database = client.db(`${process.env.DB}`);
  const appointment = database.collection("hospitaldoctorsbooking");
  // create a filter for a movie to update
  const filter = { _id: ObjectId(serviceId) };
  // this option instructs the method to create a document if no documents match the filter
  const options = { upsert: true };
  // create a document that sets the plot of the movie
  const updateDoc = {
    $set: {
      paymentStatus: `paid`,
    },
  };
  const result = await appointment.updateOne(filter, updateDoc, options);
  res.send(result);
  // console.log(
  //   `${result.matchedCount} document(s) matched the filter, updated ${result.modifiedCount} document(s)`,
  // );
});

function verifyJWT(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).send({ message: "unauthorized access" });
  }
  const token = authHeader.split(" ")[1];
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).send({ message: "Forbidden access" });
    }
    console.log("decoded", decoded);
    req.decoded = decoded;
    next();
  });
}
// ------------------------------------------------------
// ------------------------------------
// ------------------------------------
// -------
// Dynamic Date Making Function Making Function
// const moment = require('moment-timezone');
// const availableSlots = ["08.00 AM - 08.30 AM",
//   "08.30 AM - 09.00 AM",
//   "09.00 AM - 9.30 AM",
//   "09.30 AM - 10.00 AM",
//   "10.00 AM - 10.30 AM",
//   "10.30 AM - 11.00 AM",
//   "11.00 AM - 11.30 PM",
//   "11.30 AM - 12.00 PM",
//   "4.00 PM - 4.30 PM",
//   "4.30 PM - 5.00 PM",
//   "5.00 PM - 5.30 PM",
//   "5.30 PM - 6.00 PM",
//   "6.00 PM - 6.30 PM",
//   "6.30 PM - 7.00 PM",
//   "7.00 PM - 7.30 PM"]

// var moment = require('moment-timezone');
// moment().tz("America/Los_Angeles").format();

// const DynamicDate = async () => {
//   let now = moment.tz('Asia/Dhaka').format('L');
//   console.log("current date changes everyday", now)
//   let startdate = moment.tz('Asia/Dhaka').subtract(1, "days").format('L');
//   let enddate = moment.tz('Asia/Dhaka').add(4, "days").format('L');
//   var zone = moment.tz('Asia/Dhaka').format("l");
//   console.log("zone time", zone)
//   console.log("start date", startdate)
//   console.log("end date", enddate);
//   console.log(now); //is a type strin
//   // console.log("day inside function", day);
//   console.log("function running");
//   const hospitaldoctorsCollection = client.db(process.env.DB).collection('hospitaldoctors');
//   const query = {}
//   const cursor = hospitaldoctorsCollection.find(query);
//   const doctors = await cursor.toArray();
//   for (let i = 0; i < doctors.length; i++) {
//     const doctor = doctors[i];  //will be an object
//     const doctorId = doctor._id;
//     let doctorAvialableSlot = doctor.availableSlots; //will be an object of an doctor object
//     // console.log(doctorAvialableSlot["11/27/2022"])
//     if (doctorAvialableSlot[startdate] !== undefined) {
//       console.log(true);
//       delete doctorAvialableSlot[startdate];
//       // plus a date now then do another 
//       doctorAvialableSlot[enddate] = availableSlots;
//       const filter = { _id: ObjectId(doctorId) };
//       const options = { upsert: true };
//       const updateDoc = {
//         $set: { availableSlots: doctorAvialableSlot }
//       };
//       const result = await hospitaldoctorsCollection.updateOne(filter, updateDoc, options);

//     } else {
//       console.log("All slot are up to date");
//     }
//   }
// }

// setInterval(DynamicDate, 50000)
// doctor adding with current 5 days slot
// const doctorSlotAdding = (doctor) => {
//   let now = moment.tz('Asia/Dhaka').format('L');
//   let tempDoctor = doctor;
//   const availableSlots = ["08.00 AM - 08.30 AM",
//     "08.30 AM - 09.00 AM",
//     "09.00 AM - 9.30 AM",
//     "09.30 AM - 10.00 AM",
//     "10.00 AM - 10.30 AM",
//     "10.30 AM - 11.00 AM",
//     "11.00 AM - 11.30 PM",
//     "11.30 AM - 12.00 PM",
//     "4.00 PM - 4.30 PM",
//     "4.30 PM - 5.00 PM",
//     "5.00 PM - 5.30 PM",
//     "5.30 PM - 6.00 PM",
//     "6.00 PM - 6.30 PM",
//     "6.30 PM - 7.00 PM",
//     "7.00 PM - 7.30 PM"]
//   tempDoctor = { ...tempDoctor, availableSlots: {} }
//   delete tempDoctor.slots;
//   tempDoctor.availableSlots[now] = availableSlots;
//   for (i = 1; i <= 4; i++) {
//     let date = moment.tz('Asia/Dhaka').add(i, "days").format('L');
//     tempDoctor.availableSlots[date] = availableSlots;
//     // let doctorAvialableSlot = tempDoctor.availableSlots;
//     // doctorAvialableSlot[date] = availableSlots;
//   }
//   console.log(tempDoctor);
//   return tempDoctor;
// }
// add doctor with slot
app.get("/websitedoctors/findEmail", async (req, res) => {
  const hospitaldoctorsCollection = client.db(process.env.DB).collection('hospitaldoctors');
  const email = req.query.email;
  const query = { email: email };
  const doctors = await hospitaldoctorsCollection.findOne(query);
  // const doctors = await cursor.toArray();
  console.log(doctors);
  if (doctors === null) {
    res.send({ "found": false });
  } else {
    res.send({ "found": true });
  }
})
app.post("/websitedoctors", async (req, res) => {
  const doctorsCollection = client.db(process.env.DB).collection("hospitaldoctors");
  const newDoctor = req.body;
  console.log(newDoctor);
  let doctor = await doctorSlotAdding(newDoctor);
  const result = await doctorsCollection.insertOne(doctor);
  res.send(result);
});

// Update the doctor avaiale slots
app.put("/updatedoctoravailableslots", async (req, res) => {
  const slot1 = req.headers.id;
  const date = req.query.date;
  const email = req.query.email;
  console.log(email);
  const doctor = req.body;
  // delete doctor[id]
  const hospitaldoctorsCollection = client.db(process.env.DB).collection('hospitaldoctors');
  delete doctor[`_id`]
  // const newDocotor = { ...doctor, doctor[date]:slot1 }
  const replacement = doctor
  // console.log("body updatedoctoravailableslots", doctor)

  const keyDate = availableSlots[date]
  const query = {
    _id: ObjectId(slot1)
  };
  const result1 = await hospitaldoctorsCollection.deleteOne(query);
  console.log("after deleting ", result1)
  const result = await hospitaldoctorsCollection.insertOne(replacement);
  console.log("updated doctor avaiality", result);
  res.send(result);
})


// Get doctor's appointment list
app.get("/doctorsbooking/doctor", async (req, res) => {
  ///doctors
  const hospitaldoctorsbookingCollection = client.db(process.env.DB).collection('hospitaldoctorsbooking');
  const doctor = req.query.doctoremail;
  console.log("doctor email", doctor);
  const query = { doctorEmail: doctor };
  const cursor = hospitaldoctorsbookingCollection.find(query);
  const patients = await cursor.toArray();
  console.log(patients);
  res.send(patients);
})









// ------------------------------------------------------
// ------------------------------------
// ------------------------------------
// -------
// const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@products.q5pma.mongodb.net/${process.env.DB}?retryWrites=true&w=majority`;
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.k6jd9d0.mongodb.net/${process.env.DB}`;

console.log(uri);

const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1,
});

async function run() {
  try {
    await client.connect();
    // booking appointment by anik 

    // payment part 
    // app.patch('/hospitaldoctorsbooking/:id', async(req,res)=>{
    //   const paymentCollection = client.db(process.env.DB).collection('payments');
    //   const id = req.params.id;
    //   const payment = req.body;
    //   const filter = {_id:ObjectId(id)};
    //   const updatedDoc = {
    //       $set:{
    //         paid:true,
    //         transactionId:payment.transactionId
    //       }
    //   }
    //   const result = await paymentCollection.insertOne(payment);
    //   const hospitaldoctorsbookingCollection = client.db(process.env.DB).collection('hospitaldoctorsbooking');
    //   const updatedbooking = await hospitaldoctorsbookingCollection.updateOne(filter,updatedDoc);
    //   res.send(updatedDoc);
    // })






    //sslcommerz init
    app.get('/init', (req, res) => {
      const data = {
        total_amount: 100,
        currency: 'EUR',
        tran_id: 'REF123',
        success_url: 'http://localhost:5000/success',
        fail_url: 'http://yoursite.com/fail',
        cancel_url: 'http://yoursite.com/cancel',
        ipn_url: 'http://yoursite.com/ipn',
        shipping_method: 'Courier',
        product_name: 'Computer.',
        product_category: 'Electronic',
        product_profile: 'general',
        cus_name: 'Customer Name',
        cus_email: 'cust@yahoo.com',
        cus_add1: 'Dhaka',
        cus_add2: 'Dhaka',
        cus_city: 'Dhaka',
        cus_state: 'Dhaka',
        cus_postcode: '1000',
        cus_country: 'Bangladesh',
        cus_phone: '01711111111',
        cus_fax: '01711111111',
        ship_name: 'Customer Name',
        ship_add1: 'Dhaka',
        ship_add2: 'Dhaka',
        ship_city: 'Dhaka',
        ship_state: 'Dhaka',
        ship_postcode: 1000,
        ship_country: 'Bangladesh',
        multi_card_name: 'mastercard',
        value_a: 'ref001_A',
        value_b: 'ref002_B',
        value_c: 'ref003_C',
        value_d: 'ref004_D'
      };
      const sslcommer = new SSLCommerzPayment(process.env.STORE_ID, process.env.STORE_PASS, false) //true for live default false for sandbox
      sslcommer.init(data).then(data => {
        //process the response that got from sslcommerz 
        //https://developer.sslcommerz.com/doc/v4/#returned-parameters
        res.redirect(data.GatewayPageURL);
      });
    })
    app.post('/success', async (req, res) => {
      console.log(req.body)
      res.status(200).json(req.body)
    })

    app.get('/available', async (req, res) => {
      const hospitaldoctorsCollection = client.db(process.env.DB).collection('hospitaldoctors');

      const date = req.query.date || 'Oct 26, 2022';
      // step 1 
      const services = await hospitaldoctorsCollection.find().toArray();
      // step 2 
      const hospitaldoctorsbookingCollection = client.db(process.env.DB).collection('hospitaldoctorsbooking');
      const query = { date: date };
      const bookings = await hospitaldoctorsbookingCollection.find(query).toArray();
      // step 3 
      services.forEach(service => {
        const servicebookings = bookings.filter(b => b.treatment === service.name);
        const booked = servicebookings.map(s => s.slot);
        const available = service.slots.filter(s => !booked.includes(s));
        service.available = available;
        // service.booked = booked;

      })
      res.send(services);
    })

    // const productsCollection = client
    //   .db(process.env.DB)
    //   .collection(process.env.COLLECTION);
    // const usersCollection = client.db(process.env.DB).collection("users");
    // Blood Doner Posting to Database
    app.post('/bloodDoner', async (req, res) => {
      const donerInfo = req.body
      const bloodDonerCollection = client.db(process.env.DB).collection("bloodDoner");
      const result = await bloodDonerCollection.insertOne(donerInfo);
      res.send(result);
    })
    // Blood Doner List Get
    app.get('/bloodDonerList', async (req, res) => {
      const query = {}
      const bloodDonerCollection = client.db(process.env.DB).collection("bloodDoner");
      const cursor = bloodDonerCollection.find(query);
      const doners = await cursor.toArray();
      res.send(doners);
    })

    // AUTH
    app.post("/login", async (req, res) => {
      const user = req.body;
      const accessToken = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "1d",
      });
      res.send({ accessToken });
    });
    // All user post to a Database
    app.post("/api/users", async (req, res) => {
      const user = req.body
      const usersCollection = client.db(process.env.DB).collection("users");
      const result = await usersCollection.insertOne(user);
      res.send(result);
    })
    // Search for a specific user from the DB

    app.get('/api/user', async (req, res) => {
      const email = req.query.email;
      console.log(email)
      const query = { email: email };
      const usersCollection = client.db(process.env.DB).collection("users");
      const user = await usersCollection.findOne(query);
      console.log(user);
      if (user === null) {
        res.send({ "text": "No user Found" })
      } else {
        res.send(user);
      }

    })
    // see all User from the DB
    app.get("/api/allUsers", async (req, res) => {
      const query = {}
      const usersCollection = client.db(process.env.DB).collection("users");
      const cursor = usersCollection.find(query);
      const users = await cursor.toArray();
      res.send(users);
    })
    // Search for specific user using ID

    app.put('/api/allUsers', async (req, res) => {
      const updatedStatus = req.body;
      const email = req.query.email
      const usersCollection = client.db(process.env.DB).collection("users");
      const filter = { email };
      const options = { upsert: true };
      const updateDoc = {
        $set: { role: updatedStatus?.role }
      };
      const result = await usersCollection.updateOne(filter, updateDoc, options);
      res.send(result);
    })



    // See all databases
    app.get("/api/dbs", async (req, res) => {
      const collections = client.db(process.env.DB).listCollections();
      const cursor = collections;
      const dbs = await cursor.toArray()
        .then(data => data.map(item => item.name))
      res.send(dbs);
    });

    // See all doctors
    app.get("/api/doctors", async (req, res) => {
      const doctorsCollection = client.db(process.env.DB).collection('doctors');
      const query = {};
      const cursor = doctorsCollection.find(query);
      const doctors = await cursor.toArray();
      res.send(doctors);
    });

    // See individual doctor
    app.get("/api/doctors/:id", async (req, res) => {
      const id = req.params.id;
      const doctorsCollection = client.db(process.env.DB).collection('doctors');
      const query = {};
      const cursor = doctorsCollection.find(query);
      let doctor = await cursor.toArray();
      doctor = await doctor.filter((doctor) => doctor._id == id);
      res.send(doctor);
    });

    // Add new Doctor
    app.post("/api/doctors", async (req, res) => {
      const newDoctor = req.body;
      const doctorsCollection = client.db(process.env.DB).collection('doctors');
      const result = await doctorsCollection.insertOne(newDoctor);
      res.send(result);
    });

    // UPDATE Doctor Info
    app.post("/api/doctors/:id", async (req, res) => {
      const id = req.params.id;
      console.log(id);
      console.log(req.body);
      const query = { _id: ObjectId(id) };
      const doctorsCollection = client.db(process.env.DB).collection('doctors');
      let doctor = await doctorsCollection.findOne(query);
      console.log(doctor);
      doctor = { ...doctor, ...req.body };
      const result = await doctorsCollection.updateOne(
        { _id: ObjectId(id) },
        { $set: doctor }
      );
      const newResult = await doctorsCollection.findOne(query);
      res.send(newResult);
    });

    // See all meds in Pharmacy
    app.get("/api/medicines", async (req, res) => {
      const medicineCollection = client.db(process.env.DB).collection('medicine');
      const query = {};
      const cursor = medicineCollection.find(query);
      const medicines = await cursor.toArray();
      res.send(medicines);
    });

    // See individual medicine
    app.get("/api/medicine/:id", async (req, res) => {
      const id = req.params.id;
      const medicinesCollection = client.db(process.env.DB).collection('medicine');
      const query = {};
      const cursor = medicinesCollection.find(query);
      let medicine = await cursor.toArray();
      medicine = await medicine.filter((medicine) => medicine._id == id);
      res.send(medicine);
    });

    // Add new medicine
    app.post("/api/medicines", async (req, res) => {
      const newMedicine = req.body;
      const medicinesCollection = client.db(process.env.DB).collection('medicine');
      const result = await medicinesCollection.insertOne(newMedicine);
      res.send({ result });
    });

    // UPDATE medicine Info
    app.post("/api/medicines/:id", async (req, res) => {
      const id = req.params.id;
      console.log(id);
      console.log(req.body);
      const query = { _id: ObjectId(id) };
      const medicinesCollection = client.db(process.env.DB).collection('medicine');
      let medicine = await medicinesCollection.findOne(query);
      console.log(medicine);
      medicine = { ...medicine, ...req.body };
      const result = await medicinesCollection.updateOne(
        { _id: ObjectId(id) },
        { $set: medicine }
      );
      const newResult = await medicinesCollection.findOne(query);
      res.send(newResult);
    });



    // --------------  END OF CODE // DON'T LOOK BELOW THIS LINE ------------- //


    // PRODUCTS API - READ ALL
    app.get("/products", async (req, res) => {
      const query = {};
      const cursor = productsCollection.find(query);
      const products = await cursor.toArray();
      res.send(products);
    });

    app.get("/user/:id", verifyJWT, async (req, res) => {
      const id = req.params.id;
      const query = {};
      const cursor = productsCollection.find(query);
      let products = await cursor.toArray();
      products = await products.filter((product) => product.uid == id);
      res.send(products);
    });

    //READ - ONE
    app.get("/product/:id", async (req, res) => {
      const id = req.params.id;
      console.log(id);
      const query = { _id: ObjectId(id) };
      const product = await productsCollection.findOne(query);
      res.send(product);
    });

    // POST, CREATE
    app.post("/product", async (req, res) => {
      const newProduct = req.body;
      const result = await productsCollection.insertOne(newProduct);
      res.send(result);
    });

    // UPDATE
    app.post("/product/:id", async (req, res) => {
      const id = req.params.id;
      console.log(id);
      console.log(req.body);
      const query = { _id: ObjectId(id) };
      let product = await productsCollection.findOne(query);
      console.log(product);
      if (req.body.increaseByOne) product.quantity = product.quantity + 1;
      else if (req.body.decreaseByOne) {
        product.quantity = product.quantity - 1;
        product.quantitySold = product.quantitySold + 1;
      } else if (req.body.newQuantity) product.quantity = req.body.newQuantity;
      else if (req.body.addQuantity)
        product.quantity = product.quantity + req.body.addQuantity;
      else if (req.body.edititem) {
        product = { ...product, ...req.body }
      }

      const result = await productsCollection.updateOne(
        { _id: ObjectId(id) },
        { $set: product }
      );

      const newResult = await productsCollection.findOne(query);
      res.send(newResult);
    });

    // DELETE
    app.delete("/product/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const result = await productsCollection.deleteOne(query);
      res.send(result);
    });

    //CREATE
    app.post("/order", async (req, res) => {
      const order = req.body;
      const result = await orderCollection.insertOne(order);
      res.send(result);
    });
  } catch (error) {
    res.send(error);
  }
}

run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Running Products Server");
});

app.get("/hero", (req, res) => {
  res.send("Hero meets hero ku");
});

app.listen(port, () => {
  console.log("Listening to port", port);
});

