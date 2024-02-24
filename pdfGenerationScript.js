const fs = require('fs');
const PDFDocument = require('pdfkit');
const mongoose = require('mongoose');
const crimeDetails = require('./crime');

const generatePdf = async (req, res) => {
  try {
    // Fetch data from MongoDB
    const { status, startDate, endDate } = req.body;

    // Fetch data from MongoDB based on the selected status and date
    let query = {};

    if (status) {
      query.status = status;
    }

    if (startDate || endDate) {
      // If either start or end date is provided, consider crimes on that specific date
      query.date = {};

      if (startDate) {
        query.date.$gte = new Date(startDate);
      }

      if (endDate) {
        query.date.$lte = new Date(endDate);
      }
    }

    const crimeData = await crimeDetails.find(query).populate(
      'comments.userId',
      'userName'
    );

    // Create a new PDF document
    const doc = new PDFDocument();
    const outputFileName = 'crime_report.pdf'; // Adjust the filename as needed

    // Add data to the PDF
    crimeData.forEach((crime) => {
      doc.text(`Title: ${crime.title}`);
      doc.text(`Description: ${crime.description}`);
      doc.text(`Date: ${crime.date}`);
      doc.text(`Location: ${crime.location}`);
      doc.text(`Status: ${crime.status}`);
      // Add comments if available
      if (crime.comments && crime.comments.length > 0) {
        doc.text('User Comments:');
        crime.comments.forEach((comment) => {
          doc.text(`- ${comment.userName}: ${comment.commentText}`);
        });
      }
      if (crime.lwComments && crime.lwComments.length > 0) {
        doc.text(`Crime Beacon Team Comments: - ${crime.lwComments}`);
      }

      // Add a new page for each crime
      doc.addPage();
    });

    // Finalize the PDF
    doc.end();

    // Pipe the PDF to the response
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `inline; filename=${outputFileName}`
    );
    doc.pipe(res);

    console.log(`PDF generated successfully: ${outputFileName}`);
  } catch (error) {
    console.error('Error generating PDF:', error);
    res.status(500).send('Internal server error.');
  }
};

module.exports = generatePdf;
