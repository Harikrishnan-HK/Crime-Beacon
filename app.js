const express = require("express");
const bodyParser = require("body-parser");
const app = express();
require('dotenv').config();
const PORT = process.env.PORT;

const path = require("path");
const mongoose = require("mongoose");
const fileUpload = require("express-fileupload");
const session = require("express-session");
const cron = require("node-cron");
const Chart = require("chart.js");
const fs = require("fs");
const { createTransport } = require("nodemailer");
const { userInfo } = require("os");
const PDFDocument = require('pdfkit');
const generatePdf = require('./pdfGenerationScript');
const crimeDetails = require('./crime');


module.exports = app;


const transporter = createTransport({
  host: "smtp-relay.sendinblue.com",
  port: 587,
  auth: {
    user: "crimebeacon@gmail.com",
    pass: "xsmtpsib-b304a2fce7607add79d3e29ff31656edb8101e2c9ad17ab57b1c58df765a4dbb-2JRTgQfqYEBL6wW9",
  },
});

mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverSelectionTimeoutMS: 6000000
})
.then(() => console.log("Connected to DB"))
.catch((err) => console.error(err));


app.locals.userId = "";

app.locals.adminId = "";

const userdetails = mongoose.model("users", {
  firstname: String,
  lastname: String,
  address: String,
  city: String,
  zipcode: String,
  email: { type: String, unique: true },
  password: String,
  phone: Number,
  license: String,
  date: Date,
});
const adminDetails = mongoose.model("admin", {
  firstname: String,
  lastname: String,
  email: { type: String, unique: true },
  password: String,
  lawCode: String,
  date: Date,
});

const lawEnforcementSchema = new mongoose.Schema({
  lawCode: String,
});

const IDdetails = mongoose.model("lawEnIds", lawEnforcementSchema);

const lawEnforcementIDs = [
  "CB1111",
  "CB1112",
  "CB1113",
  "CB1114",
  "CB1115",
  "CB1116",
  "CB1117",
  "CB1118",
  "CB1119",
  "CB1110"
];

lawEnforcementIDs.forEach(async (id) => {
  const newLawEnforcementID = new IDdetails({ lawCode: id });
  await newLawEnforcementID.save();
});



const deleteDetails = mongoose.model("deleteRequest", {
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "users",
    required: true,
  },
  crimeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "crime",
    required: true,
  },
  reason: {
    type: String,
    required: true,
  },
});

const messageDetails = mongoose.model("message", {
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "users",
    required: true,
  },
  sender: {
    type: String,
    required: true,
  },
  content: {
    type: String,
    required: true,
  },
  date: {
    type: Date,
    default: Date.now,
  },
});

const alertDetails = mongoose.model("alerts", {
  email: String,
  phone: Number,
  alertType: [String],
  alertMethod: String,
});

const feedbackDetails = mongoose.model("feedbacks", {
  name: String,
  email: String,
  feedbackType: String,
  feedbackMessage: String,
});

const safetyAdvisoryDetails = mongoose.model("advisories", {
  subject: String,
  advisory: String,
});
const tempAdvisoryDetails = mongoose.model("tempAdvisories", {
  subject: String,
  advisory: String,
});

const reportDetails = mongoose.model("reportRequests", {
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "users",
    required: true,
  },
  crimeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "crime",
    required: true,
  },
  reportType: String,
  date: {
    type: Date,
    default: Date.now,
  },
});

// Middleware to check if the user is logged in
const requireLogin = (req, res, next) => {
  if (!req.session.userId) {
    res.redirect("/login");
  } else {
    next();
  }
};

// Middleware to check if the user is an admin
const requireAdmin = (req, res, next) => {
  if (!req.session.adminId) {
    res.redirect("/admin");
  } else {
    next();
  }
};
app.use(express.static(path.join(__dirname, "public")));

app.set("views", [
  path.join(__dirname, "views"),
  path.join(__dirname, "views/user"),
  path.join(__dirname, "views/admin"),
  path.join(__dirname, "views/crime"),
  path.join(__dirname, "views/Home"),
]);

app.set("view engine", "ejs");
app.use(fileUpload());
const filePath = "public/images/";
app.use(bodyParser.urlencoded({ extended: false }));
app.use(
  session({
    secret: "randomsecretcode",
    resave: false,
    saveUninitialized: true,
  })
);

app.get("/", (req, res) => {
  res.render("index", { successMessage: null });
});

app.get("/adminRegister", (req, res) => {
  res.render("admin/adminRegister");
});

app.get("/adminCrimeListing", requireAdmin, async (req, res) => {
  const crimeLists = await crimeDetails.find().sort({ date: -1 }).exec();

  res.render("adminCrimeListing", {
    crimeLists: crimeLists,
    successMessage: null,
  });
});


app.post("/adminRegistration", async (req, res) => {
  const { ufname, ulname, uemail, upassword, ulcode } = req.body;
  const id = await IDdetails.findOne({ lawCode:ulcode });
  if (!id) {
    return res.render("adminRegister", { errorMessage: "Invalid Law Enforcement Id Number." });
  }

  const admin = await adminDetails.findOne({
    $or: [{ email: uemail }, { lawCode: ulcode }],
  });

  if (admin != null) {
    return res.render("adminRegister", { errorMessage: "This email or Law Enforcement Id has been already used." });
  }

  const date = new Date();
  var admindata = {
    firstname: ufname,
    lastname: ulname,
    email: uemail,
    password: upassword,
    lawCode: ulcode,
    date: date,
  };

  var newAdminData = new adminDetails(admindata);
  newAdminData.save();

  res.render("adminLogin");
});

app.get("/admin", (req, res) => {
  res.render("adminLogin");
});

app.post("/adminLogin", async (req, res) => {
  const { email, password } = req.body;

  const admin = await adminDetails.findOne({ email: email }).lean();

  if (!admin) {
    res.status(404).send({ message: "No Admin found with this email" });
  } else {
    var validatePassword = false;
    if (password == admin.password) {
      validatePassword = true;
    }

    if (!validatePassword) {
      res.status(400).send({ message: "Invalid Password" });
    } else {
      req.session.adminId = admin._id;
      res.redirect("/adminDashboard");
      app.locals.adminId = admin._id;
    }
  }
});

function getMonthName(month) {
  const months = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  return months[month - 1];
}

app.get("/adminDashboard", requireAdmin, async (req, res) => {
  try {
    // Fetch user count statistics grouped by month and year
    const userStatistics = await userdetails.aggregate([
      {
        $project: {
          year: { $year: "$date" },
          month: { $month: "$date" },
        },
      },
      {
        $group: {
          _id: {
            year: "$year",
            month: "$month",
          },
          count: { $sum: 1 },
        },
      },
      {
        $sort: { "_id.year": 1, "_id.month": 1 },
      },
      {
        $project: {
          _id: 0,
          year: "$_id.year",
          month: "$_id.month",
          count: 1,
        },
      },
    ]);

    // Separate labels and data for the chart
    const labels = userStatistics.map(
      (entry) => `${getMonthName(entry.month)} ${entry.year}`
    );
    const data = userStatistics.map((entry) => entry.count);

    const deleteRequests = await deleteDetails.find().exec();

    const reportedRequests = await reportDetails.find().exec();

    const feedbackData = await feedbackDetails.find().exec();

    // Render the admin dashboard template and pass the data
    res.render("adminDashboard", {
      labels,
      data,
      deleteRequests,
      reportedRequests,
      feedbackData,
    });
  } catch (error) {
    console.error("Error fetching user statistics:", error);
    res.status(500).send("Internal server error.");
  }
});

app.get("/updateStatus", requireAdmin, async (req, res) => {
  try {
    // Retrieve all crimes from the database in descending order by date
    const crimeLists = await crimeDetails.find().sort({ date: -1 }).exec();

    // Render the Crime Listings page and pass the crimeList data to the template
    res.render("updateStatus", { crimeLists });
  } catch (error) {
    console.error("Error fetching crime listings:", error);
    res.status(500).send("Internal server error.");
  }
});
app.post("/updateStatus", async (req, res) => {
  const successMessage = "Crime Status updated";
  const utype = req.body;

  res.render("adminDashboard", { successMessage });
});
app.post("/updateStatus/:crimeId", async (req, res) => {
  const { type, comment } = req.body;
  const crimeId = req.params.crimeId;
  const statusData = req.body.type;

  try {
    const crime = await crimeDetails.findById(crimeId);

    if (!crime) {
      res.status(404).send("Crime not found");
    } else {
      // Update the crime with additional description
      crime.status = type;
      crime.lwComments = comment;

      await crime.save();      

      res.redirect("/updateStatus"); 
    }
  } catch (error) {
    console.error("Error updating crime details:", error);
    res.status(500).send("Internal server error.");
  }
});

app.get("/viewDeleteRequest/:requestId", requireAdmin, async (req, res) => {
  const requestId = req.params.requestId;

  try {
    const deleteRequest = await deleteDetails.findById(requestId);

    res.render("manageDeleteRequest", { deleteRequest });
  } catch (error) {
    console.error("Error fetching delete request details:", error);
    res.status(500).send("Internal server error.");
  }
});

app.post("/approveDeleteRequest/:requestId", async (req, res) => {
  const requestId = req.params.requestId;

  try {
    // Fetch the delete request details
    const deleteRequest = await deleteDetails.findById(requestId);

    // Check if the delete request exists
    if (!deleteRequest) {
      return res.status(404).send("Delete request not found");
    }

    // Perform the delete operation in your crimeDetails collection
    await crimeDetails.deleteOne({ _id: deleteRequest.crimeId });

    // Delete the delete request after approval
    await deleteDetails.deleteOne({ _id: requestId });

    const userId = deleteRequest.userId;

    // Send a message to the user
    const approvalMessage = `Your delete request for Crime ID ${deleteRequest.crimeId} has been approved.`;
    const approvalDate = new Date().toLocaleString();

    const approvalNotification = {
      userId: userId,
      sender: "Admin", // You can customize the sender
      content: approvalMessage,
      date: approvalDate,
    };

    // Save the approval notification to the messages collection
    const newApprovalNotification = new messageDetails(approvalNotification);
    await newApprovalNotification.save();

    res.redirect("/adminDashboard");
  } catch (error) {
    console.error("Error approving delete request:", error);
    res.status(500).send("Internal server error.");
  }
});

app.post("/rejectDeleteRequest/:requestId", async (req, res) => {
  const requestId = req.params.requestId;

  try {
    const deleteRequest = await deleteDetails.findById(requestId);

    // Delete the delete request after rejection
    await deleteDetails.deleteOne({ _id: requestId });

    const userId = deleteRequest.userId;

    // Send a message to the user
    const rejectionMessage = `Your delete request for Crime ID ${deleteRequest.crimeId} has been rejected.`;
    const rejectionDate = new Date().toLocaleString();

    const rejectionNotification = {
      userId: userId,
      sender: "Admin", // You can customize the sender
      content: rejectionMessage,
      date: rejectionDate,
    };

    // Save the rejection notification to the messages collection
    const newRejectionNotification = new messageDetails(rejectionNotification);
    await newRejectionNotification.save();

    res.redirect("/adminDashboard");
  } catch (error) {
    console.error("Error rejecting delete request:", error);
    res.status(500).send("Internal server error.");
  }
});

app.get("/register", (req, res) => {
  res.render("register");
});

const emailTakenMessage = {
  bodyMessage: "This email or phone number has been already used.",
};

const licenseInvalidMessage = {
  bodyMessage: "Invalid License Number.",
};

function validateDriverLicense(ulname, ulicense) {
  const nameInitial = ulname.charAt(0).toUpperCase();
  const pattern = new RegExp(`^${nameInitial}\\d{4}-\\d{5}-\\d{5}$`);

  return pattern.test(ulicense);
}

app.post("/registration", async (req, res) => {
  const successMessage = "Account created successfully";
  const {
    ufname,
    ulname,
    uaddress,
    ucity,
    uzip,
    uemail,
    upassword,
    uphone,
    ulicense,
  } = req.body;

  const user = await userdetails.findOne({
    $or: [{ email: uemail }, { phone: uphone }],
  });

  if (user != null) {
    return res.render("register", { emailTakenMessage: emailTakenMessage });
  }

  const isValid = validateDriverLicense(ulname, ulicense);

  if (!isValid) {
    return res.render("register", { emailTakenMessage: licenseInvalidMessage });
  }
  const date = new Date();
  var userdata = {
    firstname: ufname,
    lastname: ulname,
    address: uaddress,
    city: ucity,
    zipcode: uzip,
    email: uemail,
    password: upassword,
    phone: uphone,
    license: ulicense,
    date: date,
  };

  var newUserData = new userdetails(userdata);
  newUserData.save();

  res.render("login", { errorMessage: null, successMessage });
});

app.get("/login", (req, res) => {
  res.render("login", { errorMessage: null, successMessage: null });
});

app.post("/login", async (req, res) => {
  const { email, password } = req.body;

  const user = await userdetails.findOne({ email: email }).lean();

  if (!user) {
    res.render("login", {
      errorMessage: "No  User Found",
      successMessage: null,
    });
  } else {
    var validatePassword = false;
    if (password == user.password) {
      validatePassword = true;
    }

    if (!validatePassword) {
      res.render("login", {
        errorMessage: "Incorrect Password",
        successMessage: null,
      });
    } else {
      req.session.userId = user._id;
      res.redirect("/");
      app.locals.userName = user.firstname;
      app.locals.userId = user._id;

    }
  }
});

app.get("/terms", (req, res) => {
  res.render("terms");
});

app.get("/about", (req, res) => {
  res.render("about");
});

app.get("/contact", (req, res) => {
  res.render("contact");
});

app.get("/feedback",requireLogin, (req, res) => {
  res.render("feedback", { successMessage: null });
});

app.post("/submit-feedback", (req, res) => {
  const successMessage =
    "Your feedback submitted successfully! Thanks for your valuable feedback.";

  const { uname, uemail, utype, ufeedback } = req.body;

  var feedbackData = {
    name: uname,
    email: uemail,
    feedbackType: utype,
    feedbackMessage: ufeedback,
  };

  var newFeedbackData = new feedbackDetails(feedbackData);
  newFeedbackData.save();

  res.render("feedback", { successMessage });
});

app.get("/profile", requireLogin, async (req, res) => {
  const userId = req.session.userId;
  const user = await userdetails.findById(userId);
  console.log(req.session.userId);

  if (!user) {
    res.status(404).send("User not found");
  } else {
    res.render("profile", { user, successMessage: null });
  }
});

app.get("/updateProfile", requireLogin, async (req, res) => {
  const userId = req.session.userId;
  const user = await userdetails.findById(userId);

  if (!user) {
    res.status(404).send("User not found");
  } else {
    res.render("updateProfile", { user });
  }
});

app.post("/updateProfile", async (req, res) => {
  const successMessage = "Your profile updated successfully!";

  const {
    userId,
    newAddress,
    newCity,
    newZip,
    newPhone,
    newLicense,
    newPassword,
  } = req.body;

  const user = await userdetails.findByIdAndUpdate(
    userId,
    {
      address: newAddress,
      city: newCity,
      zipCode: newZip,
      phone: newPhone,
      license: newLicense,
      password: newPassword,
    },
    { new: true }
  );

  const isValid = validateDriverLicense(user.lastname, newLicense);

  if (!isValid) {
    return res.render("updateProfile", {
      user,
      emailTakenMessage: licenseInvalidMessage,
    });
  }

  if (!user) {
    res.status(404).send("User not found");
  } else {
    res.render("profile", { user, successMessage });
  }
});

const messages = [];
console.log(messages);

// Route to render the messages page
app.get("/message", requireLogin, async (req, res) => {
  try {
    const userId = app.locals.userId;

    // Fetch messages for the user from the database
    const userMessages = await messageDetails.find({ userId });

    res.render("message", { userId, messages: userMessages });
  } catch (error) {
    // Handle errors appropriately
    console.error(error);
    res.status(500).send("Internal Server Error");
  }
});

app.get("/crimereport", requireLogin,async (req, res) => {

  res.render("crimereport");
});

app.post("/crimereport", async (req, res) => {
  const users = await userdetails.find({ _id: req.session.userId });
  const user = users[0];
  var selectedOption = req.body.select;
  res.render("reportform", { user, selectedOption: selectedOption });
});

app.post("/reportform", async (req, res) => {
  const { title, location, description, phone, person } = req.body;

  var image = req.files.image;
  var imageName = image.name;
  var imageSavePath = filePath + imageName;
  image.mv(imageSavePath, function (err) {
    if (err) {
      console.log(err);
    }
  });
  const date = new Date();
  var crimeData = {
    title: title,
    imageLink: "images/" + imageName,
    date: date,
    description: description,
    personPhone: phone,
    personName: person,
    location: location,
    status: "unread",
    userId: req.session.userId,
  };
  var newCrime = new crimeDetails(crimeData);

  newCrime.save();
  const crimeList = await crimeDetails.find({ userId: req.session.userId });
  res.render("viewCrimes", {
    crimeList: crimeList,
    successMessage: "A new crime incident posted successfully.",
  });
});

app.get("/viewCrime", requireLogin, async (req, res) => {
  const crimeList = await crimeDetails.find({ userId: req.session.userId });

  res.render("viewCrimes", { crimeList: crimeList, successMessage: null });
});

app.get("/manageCrime/:crimeId", requireLogin, async (req, res) => {
  const crimeId = req.params.crimeId;

  try {
    const crime = await crimeDetails.findById(crimeId);

    if (!crime) {
      res.status(404).send("Crime not found");
    } else {
      res.render("manageCrime", {
        crime,
        successMessage: null,
        errorMessage: null,
      });
    }
  } catch (error) {
    console.error("Error fetching crime details:", error);
    res.status(500).send("Internal server error.");
  }
});

app.get("/updateCrime/:crimeId", requireLogin, async (req, res) => {
  const crimeId = req.params.crimeId;

  try {
    const crime = await crimeDetails.findById(crimeId);

    if (!crime) {
      res.status(404).send("Crime not found");
    } else {
      res.render("updateCrime", { crime });
    }
  } catch (error) {
    console.error("Error fetching crime details:", error);
    res.status(500).send("Internal server error.");
  }
});

app.post("/updateCrime/:crimeId", async (req, res) => {
  const crimeId = req.params.crimeId;
  const description = req.body.additionalDescription;

  try {
    const crime = await crimeDetails.findById(crimeId);

    if (!crime) {
      res.status(404).send("Crime not found");
    } else {
      // Update the crime with additional description
      crime.description += description;
      await crime.save();

      res.render("manageCrime", {
        crime,
        successMessage: "Additional description added successfully",
        errorMessage: null,
      });
    }
  } catch (error) {
    console.error("Error updating crime details:", error);
    res.status(500).send("Internal server error.");
  }
});


app.post("/manageCrime/:crimeId/deleteRequest", async (req, res) => {
  try {
    const crimeId = req.params.crimeId;
    const userId = req.session.userId;
    const reason = req.body.deleteReason;

    // Check if the crime exists
    const crime = await crimeDetails.findById(crimeId);

    if (!crime) {
      return res.render("manageCrime", {
        crime,
        errorMessage: "Crime not found",
        successMessage: null,
      });
    }

    // Validate the presence of the reason
    if (!reason) {
      return res.render("manageCrime", {
        crime,
        errorMessage: "Reason is required for the delete request.",
        successMessage: null,
      });
    }

    // Check if a delete request already exists for the crime
    const existingRequest = await deleteDetails.findOne({ crimeId });

    if (existingRequest) {
      return res.render("manageCrime", {
        crime,
        errorMessage: "Delete request already submitted for this crime.",
        successMessage: null,
      });
    }

    // Create a new delete request
    const newDeleteRequest = new deleteDetails({
      userId,
      crimeId,
      reason,
    });

    await newDeleteRequest.save();

    res.render("manageCrime", {
      crime,
      successMessage:
        "Delete request submitted to admin for approval. Post will be deleted once approved.",
      errorMessage: null,
    });
  } catch (error) {
    console.error("Error submitting delete request:", error);
    res.status(500).send("Internal server error.");
  }
});

app.get("/crimeListings", async (req, res) => {
  try {
    // Retrieve all crimes from the database in descending order by date
    const crimeLists = await crimeDetails.find().sort({ date: -1 }).exec();

    // Render the Crime Listings page and pass the crimeList data to the template
    res.render("crimeListings", {
      crimeLists,
      errorMessage: null,
      successMessage: null,
    });
  } catch (error) {
    console.error("Error fetching crime listings:", error);
    res.status(500).send("Internal server error.");
  }
});

app.post(
  "/crimeListings/:crimeId/addComment",
  requireLogin,
  async (req, res) => {
    try {
      const { commentText } = req.body;
      const crimeId = req.params.crimeId;
      const userId = req.session.userId;

      // Find the crime
      const crime = await crimeDetails.findById(crimeId);

      if (!crime) {
        return res.status(404).send("Crime not found");
      }

      // Get the user's name (assuming you have a userdetails model)
      const user = await userdetails.findById(userId);

      if (!user) {
        return res.status(404).send("User not found");
      }

      const userName = `${user.firstname} ${user.lastname}`;

      // Add the comment to the crime
      await crime.addComment(userId, userName, commentText);

      // Redirect back to the crime listings page or wherever you want
      res.redirect("/crimeListings");
    } catch (error) {
      console.error("Error adding comment:", error);
      res.status(500).send("Internal server error.");
    }
  }
);

app.post(
  "/crimeListings/:crimeId/submitReport",
  requireLogin,
  async (req, res) => {
    try {
      const { reportType } = req.body;
      const crimeId = req.params.crimeId;
      const userId = req.session.userId;

      // Check if the user has already reported this crime
      const existingReport = await reportDetails.findOne({ userId, crimeId });

      if (existingReport) {
        const crimeLists = await crimeDetails.find().sort({ date: -1 }).exec();
        res.render("crimeListings", {
          crimeLists,
          errorMessage: `You have already reported the crime (Id:${crimeId}).`,
          successMessage: null,
        });
      } else {
        // Create a new report
        const newReport = new reportDetails({
          userId,
          crimeId,
          reportType,
        });

        await newReport.save();

        const crimeLists = await crimeDetails.find().sort({ date: -1 }).exec();

        res.render("crimeListings", {
          crimeLists,
          successMessage: "Your report request has been submitted to Admin.",
          errorMessage: null,
        });
      }
    } catch (error) {
      console.error("Error submitting report:", error);
      res.status(500).send("Internal server error.");
    }
  }
);

app.get(
  "/adminDashboard/manageReportRequest/:reportId",
  requireAdmin,
  async (req, res) => {
    const reportId = req.params.reportId;

    try {
      // Fetch the report details
      const report = await reportDetails.findById(reportId);

      if (!report) {
        res.status(404).send("Report not found");
      } else {
        res.render("manageReportRequest", { report });
      }
    } catch (error) {
      console.error("Error fetching report details:", error);
      res.status(500).send("Internal server error.");
    }
  }
);

// Endpoint for handling report approval
app.post("/approveReportRequest/:reportId", requireAdmin, async (req, res) => {
  const reportId = req.params.reportId;

  try {
    // Fetch the report details
    const report = await reportDetails.findById(reportId);

    // Check if the report exists
    if (!report) {
      return res.status(404).send("Report not found");
    }

    // Notify the users involved (change the notification messages accordingly)
    const crime = await crimeDetails.findById(report.crimeId);
    const crimeUserId = crime.userId;

    const approvalMessageForCrimeUser = `Your crime has been reported and approved for the reason: ${report.reportType}. The incident is removed after verification.`;

    const approvalMessageForReporter = `Your report for the crime has been approved. The incident is removed after verification.`;

    await crimeDetails.deleteOne({ _id: report.crimeId });

    // Delete the delete request after approval
    await reportDetails.deleteOne({ _id: reportId });

    const userId = report.userId;

    // Send a message to the user
    const approvalDate = new Date().toLocaleString();

    const approvalUserNotification = {
      userId: crimeUserId,
      sender: "Admin", // You can customize the sender
      content: approvalMessageForCrimeUser,
      date: approvalDate,
    };

    const approvalReporterNotification = {
      userId: userId,
      sender: "Admin", // You can customize the sender
      content: approvalMessageForReporter,
      date: approvalDate,
    };

    // Save the approval notification to the messages collection
    const newApprovalUserNotification = new messageDetails(
      approvalUserNotification
    );
    await newApprovalUserNotification.save();

    const newApprovalReporterNotification = new messageDetails(
      approvalReporterNotification
    );
    await newApprovalReporterNotification.save();

    res.redirect("/adminDashboard");
  } catch (error) {
    console.error("Error approving report:", error);
    res.status(500).send("Internal server error.");
  }
});

// Endpoint for handling report rejection
app.post("/rejectReportRequest/:reportId", requireAdmin, async (req, res) => {
  const reportId = req.params.reportId;

  try {
    // Fetch the report details
    const report = await reportDetails.findById(reportId);

    // Check if the report exists
    if (!report) {
      return res.status(404).send("Report not found");
    }

    // Notify the user involved (change the notification message accordingly)
    const rejectionMessage = `Your report for the crime has been rejected.`;

    await reportDetails.deleteOne({ _id: reportId });

    const userId = report.userId || "";
    // Send a message to the user
    const rejectionDate = new Date().toLocaleString();

    const rejectionNotification = {
      userId: userId,
      sender: "Admin", // You can customize the sender
      content: rejectionMessage,
      date: rejectionDate,
    };

    // Save the rejection notification to the messages collection
    const newRejectionNotification = new messageDetails(rejectionNotification);
    await newRejectionNotification.save();

    res.redirect("/adminDashboard");
  } catch (error) {
    console.error("Error rejecting report:", error);
    res.status(500).send("Internal server error.");
  }
});

app.get("/communityAlert", (req, res) => {
  res.render("communityAlert", { successMessage: null, errorMessage: null });
});

app.post("/communityAlert", async (req, res) => {
  const { email, phone, alerttype, alertmethod } = req.body;

  const existingAlert = await alertDetails.findOne({ email });

  if (existingAlert) {
    // Email already subscribed
    res.render("communityAlert", {
      errorMessage: "User already subscribed to Alerts.",
      successMessage: null,
    });
    return;
  }

  var alertData = {
    email: email,
    phone: phone,
    alertType: alerttype,
    alertMethod: alertmethod,
  };

  var newAlertData = new alertDetails(alertData);
  newAlertData.save();

  const mailOptions = {
    from: "crimebeacon@gmail.com",
    to: email,
    subject: "Community Alert Subscription Success",
    // text: `You have successfully subscribed to community alerts. You will start receiving ${alerttype}. Thank you!`,
    html: fs.readFileSync(
      path.join(__dirname, "public", "html", "mail.html"),
      "utf-8"
    ),
  };

  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      console.log(error);
    } else {
      console.log("Email sent: " + info.response);
    }
  });

  res.render("communityAlert", {
    successMessage:
      "Successfully subscribed to Alerts. Thanks for Subscribing!",
    errorMessage: null,
  });
});

app.get("/unsubscribeAlerts", (req, res) => {
  res.render("communityAlert", { errorMessage: null, successMessage: null });
});

app.post("/unsubscribeAlerts", async (req, res) => {
  const { emailUnsubscribe } = req.body;

  try {
    const existingAlert = await alertDetails.findOne({
      email: emailUnsubscribe,
    });

    if (existingAlert) {
      await alertDetails.deleteOne({ email: emailUnsubscribe });
      res.json({ successMessage: "You are unsubscribed from Alerts." });
    } else {
      // User is not subscribed
      res.status(400).json({ errorMessage: "You are not subscribed already." });
    }
  } catch (error) {
    console.error("Error unsubscribing from alerts:", error);
    res.status(500).json({ errorMessage: "Internal server error." });
  }
});

app.get("/addSafetyAdvisory", requireAdmin, (req, res) => {
  res.render("addSafetyAdvisory", { advisoryAdded: null });
});

app.post("/addSafetyAdvisory", async (req, res) => {
  const { action, subject, advisory } = req.body;

  if (action === "add") {
    try {
      const { subject, advisory } = req.body;
      const advisoryAdded = "A Safety Advisory added successfully!";
      const newAdvisoryData = new safetyAdvisoryDetails({
        subject: subject,
        advisory: advisory,
      });

      await newAdvisoryData.save();

      res.render("addSafetyAdvisory", { advisoryAdded });
    } catch (error) {
      console.error("Error adding safety advisory:", error);
      res.status(500).send("Internal server error.");
    }
    // Handle the "Add Advisory" action
  } else if (action === "sendNow") {
    try {
      const { subject, advisory } = req.body;

      console.log("Received data from form:", { subject, advisory });

      // Save the temporary advisory to the new collection
      const newTemporaryAdvisory = new tempAdvisoryDetails({
        subject: subject,
        advisory: advisory,
      });

      await newTemporaryAdvisory.save();

      // Call the function to send the advisory immediately
      await sendSafetyAdvisories(true); // Use temporary advisories

      res.render("addSafetyAdvisory", {
        advisoryAdded: "Advisory sent immediately!",
      });
    } catch (error) {
      console.error("Error sending advisory immediately:", error);
      res.status(500).send("Internal server error.");
    }
  }
});

async function sendSafetyAdvisories(useTemporaryAdvisories = false) {
  try {
    let advisories;

    if (useTemporaryAdvisories) {
      advisories = await tempAdvisoryDetails.find().exec();
    } else {
      advisories = await safetyAdvisoryDetails.find().exec();
    }

    const subscribers = await alertDetails
      .find({ alertMethod: "Email" })
      .exec();

    if (advisories.length === 0) {
      console.log("No advisories found.");
      return;
    }

    if (subscribers.length === 0) {
      console.log("No email subscribers found.");
      return;
    }

    for (const subscriber of subscribers) {
      const advisory =
        advisories[Math.floor(Math.random() * advisories.length)];

      const mailOptions = {
        from: "crimebeacon@gmail.com",
        to: subscriber.email,
        subject: `Today's Advisory - ${advisory.subject}`,
        html: `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Strict//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-strict.dtd"> <html xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office"><head><meta http-equiv="Content-Type" content="text/html; charset=utf-8"><meta http-equiv="X-UA-Compatible" content="IE=edge"><meta name="format-detection" content="telephone=no"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title></title><style type="text/css" emogrify="no">#outlook a { padding:0; } .ExternalClass { width:100%; } .ExternalClass, .ExternalClass p, .ExternalClass span, .ExternalClass font, .ExternalClass td, .ExternalClass div { line-height: 100%; } table td { border-collapse: collapse; mso-line-height-rule: exactly; } .editable.image { font-size: 0 !important; line-height: 0 !important; } .nl2go_preheader { display: none !important; mso-hide:all !important; mso-line-height-rule: exactly; visibility: hidden !important; line-height: 0px !important; font-size: 0px !important; } body { width:100% !important; -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%; margin:0; padding:0; } img { outline:none; text-decoration:none; -ms-interpolation-mode: bicubic; } a img { border:none; } table { border-collapse:collapse; mso-table-lspace:0pt; mso-table-rspace:0pt; } th { font-weight: normal; text-align: left; } *[class="gmail-fix"] { display: none !important; } </style><style type="text/css" emogrify="no"> @media (max-width: 600px) { .gmx-killpill { content: '';} } </style><style type="text/css" emogrify="no">@media (max-width: 600px) { .gmx-killpill { content: ' ';} .r0-o { border-style: solid !important; margin: 0 auto 0 auto !important; width: 320px !important } .r1-i { background-color: #ffffff !important } .r2-c { box-sizing: border-box !important; text-align: center !important; valign: top !important; width: 100% !important } .r3-o { border-style: solid !important; margin: 0 auto 0 auto !important; width: 100% !important } .r4-i { padding-bottom: 0px !important; padding-left: 0px !important; padding-right: 0px !important; padding-top: 0px !important } .r5-c { box-sizing: border-box !important; display: block !important; valign: top !important; width: 100% !important } .r6-o { border-style: solid !important; width: 100% !important } .r7-i { padding-left: 0px !important; padding-right: 0px !important } .r8-i { padding-bottom: 0px !important; padding-left: 15px !important; padding-right: 15px !important; padding-top: 0px !important } .r9-c { box-sizing: border-box !important; text-align: left !important; valign: top !important; width: 100% !important } .r10-o { border-style: solid !important; margin: 0 auto 0 0 !important; width: 100% !important } .r11-i { background-color: #ffffff !important; padding-top: 0px !important; text-align: center !important } .r12-i { padding-top: 15px !important; text-align: left !important } .r13-i { padding-bottom: 15px !important; padding-top: 15px !important; text-align: left !important } .r14-i { background-color: #ffffff !important; padding-bottom: 0px !important; padding-left: 0px !important; padding-right: 0px !important; padding-top: 0px !important } .r15-o { background-size: auto !important; border-style: solid !important; margin: 0 auto 0 auto !important; width: 100% !important } .r16-i { background-color: #eff2f7 !important; padding-bottom: 20px !important; padding-left: 15px !important; padding-right: 15px !important; padding-top: 20px !important } .r17-i { padding-bottom: 0px !important; padding-top: 15px !important; text-align: center !important } .r18-i { padding-bottom: 0px !important; padding-top: 0px !important; text-align: center !important } .r19-i { padding-bottom: 15px !important; padding-top: 15px !important; text-align: center !important } .r20-c { box-sizing: border-box !important; text-align: center !important; width: 100% !important } .r21-c { box-sizing: border-box !important; width: 100% !important } .r22-i { font-size: 0px !important; padding-bottom: 15px !important; padding-left: 65px !important; padding-right: 65px !important; padding-top: 15px !important } .r23-c { box-sizing: border-box !important; width: 32px !important } .r24-o { border-style: solid !important; margin-right: 8px !important; width: 32px !important } .r25-i { padding-bottom: 5px !important; padding-top: 5px !important } .r26-o { border-style: solid !important; margin-right: 0px !important; width: 32px !important } .r27-i { padding-bottom: 15px !important; padding-left: 0px !important; padding-right: 0px !important; padding-top: 0px !important } .r28-c { box-sizing: border-box !important; text-align: center !important; valign: top !important; width: 129px !important } .r29-o { border-style: solid !important; margin: 0 auto 0 auto !important; width: 129px !important } body { -webkit-text-size-adjust: none } .nl2go-responsive-hide { display: none } .nl2go-body-table { min-width: unset !important } .mobshow { height: auto !important; overflow: visible !important; max-height: unset !important; visibility: visible !important; border: none !important } .resp-table { display: inline-table !important } .magic-resp { display: table-cell !important } } </style><style type="text/css">p, h1, h2, h3, h4, ol, ul { margin: 0; } a, a:link { color: #696969; text-decoration: underline } .nl2go-default-textstyle { color: #3b3f44; font-family: arial,helvetica,sans-serif; font-size: 16px; line-height: 1.5; word-break: break-word } .default-button { color: #ffffff; font-family: arial,helvetica,sans-serif; font-size: 16px; font-style: normal; font-weight: normal; line-height: 1.15; text-decoration: none; word-break: break-word } .default-heading1 { color: #1F2D3D; font-family: arial,helvetica,sans-serif; font-size: 36px; word-break: break-word } .default-heading2 { color: #1F2D3D; font-family: arial,helvetica,sans-serif; font-size: 32px; word-break: break-word } .default-heading3 { color: #1F2D3D; font-family: arial,helvetica,sans-serif; font-size: 24px; word-break: break-word } .default-heading4 { color: #1F2D3D; font-family: arial,helvetica,sans-serif; font-size: 18px; word-break: break-word } a[x-apple-data-detectors] { color: inherit !important; text-decoration: inherit !important; font-size: inherit !important; font-family: inherit !important; font-weight: inherit !important; line-height: inherit !important; } .no-show-for-you { border: none; display: none; float: none; font-size: 0; height: 0; line-height: 0; max-height: 0; mso-hide: all; overflow: hidden; table-layout: fixed; visibility: hidden; width: 0; } </style><!--[if mso]><xml> <o:OfficeDocumentSettings> <o:AllowPNG/> <o:PixelsPerInch>96</o:PixelsPerInch> </o:OfficeDocumentSettings> </xml><![endif]--><style type="text/css">a:link{color: #696969; text-decoration: underline;}</style></head><body bgcolor="#ffffff" text="#3b3f44" link="#696969" yahoo="fix" style="background-color: #ffffff;"> <table cellspacing="0" cellpadding="0" border="0" role="presentation" class="nl2go-body-table" width="100%" style="background-color: #ffffff; width: 100%;"><tr><td> <table cellspacing="0" cellpadding="0" border="0" role="presentation" width="900" align="center" class="r0-o" style="table-layout: fixed; width: 900px;"><tr><td valign="top" class="r1-i" style="background-color: #ffffff;"> <table cellspacing="0" cellpadding="0" border="0" role="presentation" width="100%" align="center" class="r3-o" style="table-layout: fixed; width: 100%;"><tr><td class="r4-i"> <table width="100%" cellspacing="0" cellpadding="0" border="0" role="presentation"><tr><th width="100%" valign="top" class="r5-c" style="font-weight: normal;"> <table cellspacing="0" cellpadding="0" border="0" role="presentation" width="100%" class="r6-o" style="table-layout: fixed; width: 100%;"><tr><td valign="top" class="r7-i"> <table width="100%" cellspacing="0" cellpadding="0" border="0" role="presentation"><tr><td class="r2-c" align="center"> <table cellspacing="0" cellpadding="0" border="0" role="presentation" width="540" class="r3-o" style="table-layout: fixed; width: 540px;"><tr><td class="r4-i" style="font-size: 0px; line-height: 0px;"> <img src="https://img.mailinblue.com/6736481/images/content_library/original/65627bdc4e3a45386305eb93.jpg" width="540" border="0" style="display: block; width: 100%;"></td> </tr></table></td> </tr></table></td> </tr></table></th> </tr></table></td> </tr></table><table cellspacing="0" cellpadding="0" border="0" role="presentation" width="100%" align="center" class="r3-o" style="table-layout: fixed; width: 100%;"><tr><td class="r8-i"> <table width="100%" cellspacing="0" cellpadding="0" border="0" role="presentation"><tr><th width="100%" valign="top" class="r5-c" style="font-weight: normal;"> <table cellspacing="0" cellpadding="0" border="0" role="presentation" width="100%" class="r6-o" style="table-layout: fixed; width: 100%;"><tr><td valign="top" class="r7-i"> <table width="100%" cellspacing="0" cellpadding="0" border="0" role="presentation"><tr><td class="r9-c" align="left"> <table cellspacing="0" cellpadding="0" border="0" role="presentation" width="100%" class="r10-o" style="table-layout: fixed; width: 100%;"><tr><td align="center" valign="top" class="r11-i nl2go-default-textstyle" style="color: #3b3f44; font-family: arial,helvetica,sans-serif; font-size: 16px; line-height: 1.5; word-break: break-word; background-color: #ffffff; text-align: center;"> <div><h2 class="default-heading2" style="margin: 0; color: #1f2d3d; font-family: arial,helvetica,sans-serif; font-size: 32px; word-break: break-word;"><span style="color: #BC4F4F;">Safety Advisory</span></h2></div> </td> </tr></table></td> </tr></table></td> </tr></table></th> </tr></table></td> </tr></table><table cellspacing="0" cellpadding="0" border="0" role="presentation" width="100%" align="center" class="r3-o" style="table-layout: fixed; width: 100%;"><tr><td class="r8-i"> <table width="100%" cellspacing="0" cellpadding="0" border="0" role="presentation"><tr><th width="100%" valign="top" class="r5-c" style="font-weight: normal;"> <table cellspacing="0" cellpadding="0" border="0" role="presentation" width="100%" class="r6-o" style="table-layout: fixed; width: 100%;"><tr><td valign="top" class="r7-i"> <table width="100%" cellspacing="0" cellpadding="0" border="0" role="presentation"><tr><td class="r9-c" align="left"> <table cellspacing="0" cellpadding="0" border="0" role="presentation" width="100%" class="r10-o" style="table-layout: fixed; width: 100%;"><tr><td align="left" valign="top" class="r12-i nl2go-default-textstyle" style="color: #3b3f44; font-family: arial,helvetica,sans-serif; font-size: 16px; line-height: 1.5; word-break: break-word; padding-top: 15px; text-align: left;"> <div><h2 class="default-heading2" style="margin: 0; color: #1f2d3d; font-family: arial,helvetica,sans-serif; font-size: 32px; word-break: break-word;">${advisory.subject}</h2></div> </td> </tr></table></td> </tr><tr><td class="r9-c" align="left"> <table cellspacing="0" cellpadding="0" border="0" role="presentation" width="100%" class="r10-o" style="table-layout: fixed; width: 100%;"><tr><td align="left" valign="top" class="r13-i nl2go-default-textstyle" style="color: #3b3f44; font-family: arial,helvetica,sans-serif; font-size: 16px; line-height: 1.5; word-break: break-word; padding-bottom: 15px; padding-top: 15px; text-align: left;"> <div><p style="margin: 0;"> ${advisory.advisory}</p></div> </td> </tr></table></td> </tr></table></td> </tr></table></th> </tr></table></td> </tr></table><table cellspacing="0" cellpadding="0" border="0" role="presentation" width="100%" align="center" class="r3-o" style="table-layout: fixed; width: 100%;"><tr><td class="r14-i" style="background-color: #ffffff;"> <table width="100%" cellspacing="0" cellpadding="0" border="0" role="presentation"><tr><th width="100%" valign="top" class="r5-c" style="font-weight: normal;"> <table cellspacing="0" cellpadding="0" border="0" role="presentation" width="100%" class="r6-o" style="table-layout: fixed; width: 100%;"><tr><td valign="top" class="r4-i"> <table width="100%" cellspacing="0" cellpadding="0" border="0" role="presentation"><tr><td class="r2-c" align="center"> <table cellspacing="0" cellpadding="0" border="0" role="presentation" width="900" class="r15-o" style="border-collapse: separate; border-radius: 15px; table-layout: fixed; width: 900px;"><tr><td class="r4-i" style="border-radius: 15px; font-size: 0px; line-height: 0px;"> <img src="https://img.mailinblue.com/6736481/images/content_library/original/6562a02277733b7ead65895b.jpeg" width="900" border="0" style="display: block; width: 100%; border-radius: 15px;"></td> </tr></table></td> </tr></table></td> </tr></table></th> </tr></table></td> </tr></table><table cellspacing="0" cellpadding="0" border="0" role="presentation" width="100%" align="center" class="r3-o" style="table-layout: fixed; width: 100%;"><tr><td class="r16-i" style="background-color: #eff2f7; padding-bottom: 20px; padding-top: 20px;"> <table width="100%" cellspacing="0" cellpadding="0" border="0" role="presentation"><tr><th width="100%" valign="top" class="r5-c" style="font-weight: normal;"> <table cellspacing="0" cellpadding="0" border="0" role="presentation" width="100%" class="r6-o" style="table-layout: fixed; width: 100%;"><tr><td valign="top" class="r4-i" style="padding-left: 15px; padding-right: 15px;"> <table width="100%" cellspacing="0" cellpadding="0" border="0" role="presentation"><tr><td class="r9-c" align="left"> <table cellspacing="0" cellpadding="0" border="0" role="presentation" width="100%" class="r10-o" style="table-layout: fixed; width: 100%;"><tr><td align="center" valign="top" class="r17-i nl2go-default-textstyle" style="color: #3b3f44; font-family: arial,helvetica,sans-serif; word-break: break-word; font-size: 18px; line-height: 1.5; padding-top: 15px; text-align: center;"> <div><p style="margin: 0;"><strong>CrimeBeacon Team</strong></p></div> </td> </tr></table></td> </tr><tr><td class="r9-c" align="left"> <table cellspacing="0" cellpadding="0" border="0" role="presentation" width="100%" class="r10-o" style="table-layout: fixed; width: 100%;"><tr><td align="center" valign="top" class="r18-i nl2go-default-textstyle" style="color: #3b3f44; font-family: arial,helvetica,sans-serif; word-break: break-word; font-size: 18px; line-height: 1.5; text-align: center;"> <div><p style="margin: 0; font-size: 14px;">158 King Street, N2J 0E5, Waterloo</p></div> </td> </tr></table></td> </tr><tr><td class="r2-c" align="center"> <table cellspacing="0" cellpadding="0" border="0" role="presentation" width="348" class="r3-o" style="border-collapse: separate; border-radius: 20px; table-layout: fixed; width: 348px;"><tr><td style="border-radius: 20px; font-size: 0px; line-height: 0px;"> <img src="https://img.mailinblue.com/6736481/images/content_library/original/65627c64a16ce26795281a5a.png" width="348" border="0" style="display: block; width: 100%; border-radius: 20px;"></td> </tr></table></td> </tr><tr><td class="r9-c" align="left"> <table cellspacing="0" cellpadding="0" border="0" role="presentation" width="100%" class="r10-o" style="table-layout: fixed; width: 100%;"><tr><td align="center" valign="top" class="r17-i nl2go-default-textstyle" style="color: #3b3f44; font-family: arial,helvetica,sans-serif; word-break: break-word; font-size: 18px; line-height: 1.5; padding-top: 15px; text-align: center;"> <div><p style="margin: 0; font-size: 14px;">This email was sent to {{contact.EMAIL}}</p></div> </td> </tr></table></td> </tr><tr><td class="r9-c" align="left"> <table cellspacing="0" cellpadding="0" border="0" role="presentation" width="100%" class="r10-o" style="table-layout: fixed; width: 100%;"><tr><td align="center" valign="top" class="r18-i nl2go-default-textstyle" style="color: #3b3f44; font-family: arial,helvetica,sans-serif; word-break: break-word; font-size: 18px; line-height: 1.5; text-align: center;"> <div><p style="margin: 0; font-size: 14px;">You've received this email because you've subscribed to our newsletter.</p></div> </td> </tr></table></td> </tr><tr><td class="r9-c" align="left"> <table cellspacing="0" cellpadding="0" border="0" role="presentation" width="100%" class="r10-o" style="table-layout: fixed; width: 100%;"><tr><td align="center" valign="top" class="r19-i nl2go-default-textstyle" style="color: #3b3f44; font-family: arial,helvetica,sans-serif; word-break: break-word; font-size: 18px; line-height: 1.5; padding-bottom: 15px; padding-top: 15px; text-align: center;"> <div><p style="margin: 0; font-size: 14px;"><a href="{{ unsubscribe }}" target="_blank" style="color: #696969; text-decoration: underline;">Unsubscribe</a></p></div> </td> </tr></table></td> </tr><tr><td class="r20-c" align="center"> <table cellspacing="0" cellpadding="0" border="0" role="presentation" width="870" align="center" class="r3-o" style="table-layout: fixed; width: 870px;"><tr><td valign="top"> <table width="100%" cellspacing="0" cellpadding="0" border="0" role="presentation"><tr><td class="r21-c" style="display: inline-block;"> <table cellspacing="0" cellpadding="0" border="0" role="presentation" width="870" class="r6-o" style="table-layout: fixed; width: 870px;"><tr><td class="r22-i" style="padding-bottom: 15px; padding-left: 359px; padding-right: 359px; padding-top: 15px;"> <table width="100%" cellspacing="0" cellpadding="0" border="0" role="presentation"><tr><th width="40" class="r23-c mobshow resp-table" style="font-weight: normal;"> <table cellspacing="0" cellpadding="0" border="0" role="presentation" width="100%" class="r24-o" style="table-layout: fixed; width: 100%;"><tr><td class="r25-i" style="font-size: 0px; line-height: 0px; padding-bottom: 5px; padding-top: 5px;"> <img src="https://creative-assets.mailinblue.com/editor/social-icons/rounded_colored/facebook_32px.png" width="32" border="0" style="display: block; width: 100%;"></td> <td class="nl2go-responsive-hide" width="8" style="font-size: 0px; line-height: 1px;">­ </td> </tr></table></th> <th width="40" class="r23-c mobshow resp-table" style="font-weight: normal;"> <table cellspacing="0" cellpadding="0" border="0" role="presentation" width="100%" class="r24-o" style="table-layout: fixed; width: 100%;"><tr><td class="r25-i" style="font-size: 0px; line-height: 0px; padding-bottom: 5px; padding-top: 5px;"> <img src="https://creative-assets.mailinblue.com/editor/social-icons/rounded_colored/twitter_32px.png" width="32" border="0" style="display: block; width: 100%;"></td> <td class="nl2go-responsive-hide" width="8" style="font-size: 0px; line-height: 1px;">­ </td> </tr></table></th> <th width="40" class="r23-c mobshow resp-table" style="font-weight: normal;"> <table cellspacing="0" cellpadding="0" border="0" role="presentation" width="100%" class="r24-o" style="table-layout: fixed; width: 100%;"><tr><td class="r25-i" style="font-size: 0px; line-height: 0px; padding-bottom: 5px; padding-top: 5px;"> <img src="https://creative-assets.mailinblue.com/editor/social-icons/rounded_colored/youtube_32px.png" width="32" border="0" style="display: block; width: 100%;"></td> <td class="nl2go-responsive-hide" width="8" style="font-size: 0px; line-height: 1px;">­ </td> </tr></table></th> <th width="32" class="r23-c mobshow resp-table" style="font-weight: normal;"> <table cellspacing="0" cellpadding="0" border="0" role="presentation" width="100%" class="r26-o" style="table-layout: fixed; width: 100%;"><tr><td class="r25-i" style="font-size: 0px; line-height: 0px; padding-bottom: 5px; padding-top: 5px;"> <img src="https://creative-assets.mailinblue.com/editor/social-icons/rounded_colored/linkedin_32px.png" width="32" border="0" style="display: block; width: 100%;"></td> </tr></table></th> </tr></table></td> </tr></table></td> </tr></table></td> </tr></table></td> </tr><tr><td class="r20-c" align="center"> <table cellspacing="0" cellpadding="0" border="0" role="presentation" width="100%" align="center" class="r3-o" style="table-layout: fixed; width: 100%;"><tr><td valign="top" class="r27-i" style="padding-bottom: 15px;"> <table width="100%" cellspacing="0" cellpadding="0" border="0" role="presentation"><tr><td class="r28-c" align="center"> <table cellspacing="0" cellpadding="0" border="0" role="presentation" width="129" class="r29-o" style="table-layout: fixed;"><tr><td height="48" style="font-size: 0px; line-height: 0px;"> <a href="https://www.brevo.com?utm_source=logo_client&utm_medium=email"><img src="https://creative-assets.mailinblue.com/rnb-assets/en.png" width="129" height="48" border="0" style="display: block; width: 100%;"></a></td> </tr></table></td> </tr></table></td> </tr></table></td> </tr></table></td> </tr></table></th> </tr></table></td> </tr></table></td> </tr></table></td> </tr></table></body></html>`,
      };

      const sendMailPromise = new Promise((resolve, reject) => {
        transporter.sendMail(mailOptions, (error, info) => {
          if (error) {
            console.log(
              `Error sending advisory to ${subscriber.email}: ${error}`
            );
            reject(error);
          } else {
            console.log(`Advisory sent to ${subscriber.email}`);
            resolve(info);
          }
        });
      });

      try {
        await sendMailPromise;
      } catch (error) {
        console.error("Error sending email:", error);
      }
    }
  } catch (error) {
    console.error("Error sending advisories:", error);
  }
}

// cron.schedule("*/2 * * * *", () => {
//   sendSafetyAdvisories(false); // Send saved advisories periodically
// });

app.get("/generateReport",requireAdmin, (req, res) => {
  res.render("generateReport", { successMessage: null });
});

app.post('/generateReport', generatePdf);

app.get("/logout", (req, res) => {
  const logoutMessage = "Logged out successfully!";
  app.locals.userId = "";
  req.session.destroy();
  res.render("index", { logoutMessage });
});

app.listen(PORT, () => {
  console.log(`listening on port http://localhost:${PORT}`);
});
