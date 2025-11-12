const ExcelJS = require("exceljs");
const  {jsPDF}  = require("jspdf");
require("jspdf-autotable");
const Order=require('../models/orderModel')


// calculate sale summary
const calculateSalesSummary = async (salesData) => {
  return {
    totalOrders: salesData.length,
    totalSales: salesData.reduce((sum, order) => sum + order.total, 0),
    totalDiscount: salesData.reduce(
      (sum, order) => sum + (order.discount || 0),
      0
    ),
    averageOrderValue:
      salesData.length > 0
        ? salesData.reduce((sum, order) => sum + order.total, 0) /
          salesData.length
        : 0,
  };
};

// Remove the salesController object and directly export individual functions
const renderSalesReport = async (req, res) => {
    
  try {
    
    const today = new Date();
    const startOfDay = new Date(today.setHours(0, 0, 0, 0));
    const endOfDay = new Date(today.setHours(23, 59, 59, 999));

    // Get initial daily sales data
    const salesData = await Order.find({
      createdAt: { $gte: startOfDay, $lte: endOfDay },
      status: { $nin: ["cancelled"] },
    })
      .populate("userId", "name")
      .populate("items.productId");

    // Calculate summary statistics
    const summary = await calculateSalesSummary(salesData);

    res.render("admin/report", {
      sales: salesData,
      summary,
      reportType: "daily",
    });
    
  } catch (error) {
    console.error("Error rendering sales report:", error);
    res.status(500).send("Error loading sales report");
  }
};

const getSalesReport = async (req, res) => {
    console.log("Full Request Body:", req.body);
    console.log("Report Type:", req.body.reportType);
    try {
        const { reportType, startDate, endDate } = req.body;

        // Validate report type
        if (!reportType) {
            return res.status(400).json({
                success: false,
                message: "Report type is required",
            });
        }

        let dateQuery={ paymentStatus:'paid'}
        const now = new Date();

        switch(reportType){
            case 'daily':
                dateQuery.createdAt={
                    $gte:new Date(now.setHours(0,0,0,0)),
                    $lte:new Date(now.setHours(23,59,59,999))

                }
            break;

            case 'weekly':
                const startOfWeek=new Date(now.setDate(now.getDate()-now.getDay()))
                dateQuery.createdAt={
                    $gte:new Date(startOfWeek.setHours(0,0,0,0)),
                    $lte:new Date()
                }
            break;

            case 'monthly':
                const startOfMonth=new Date(now.getFullYear(),now.getMonth(),1)
                dateQuery.createdAt={
                    $gte:startOfMonth,
                    $lte:new Date()
                }
            break;

            case 'custom':
                if(!startDate||!endDate){
                    return res.status(400).json({
                        success: false,
                        message: "Start and end dates are required for custom report",
                    })
                }
                dateQuery.createdAt={
                    $gte:new Date(startDate),
                    $lte:new Date(new Date(endDate).setHours(23,59,59,999))
                }
            break;

            default:                
                return res.status(400).json({
                    success: false,
                    message: "Invalid report type",
                });
        }

        const salesData=await Order.find(dateQuery)
                                   .populate("userId", "name email")
                                   .populate("items.productId")
                                   .sort({ createdAt: -1 });
        
      
        const summary = await calculateSalesSummary(salesData);

        // Return response
        res.json({
            success: true,
            sales: salesData,
            summary,
        });
    } catch (error) {
        console.error("Error generating sales report:", error);
        res.status(500).json({
            success: false,
            message: "Error generating sales report",
            error: error.message,
        }); 
    }
}

const downloadExcel= async (req,res)=>{
    try {
        const { reportType, startDate, endDate } = req.query;
        console.log('download query..',req.query)

        let dateQuery={paymentStatus:'paid'}//{status:"delivered"}
        let now=new Date()

    switch (reportType) {
      case "daily":
        dateQuery.createdAt = {
          $gte: new Date(now.setHours(0, 0, 0, 0)),
          $lte: new Date(now.setHours(23, 59, 59, 999)),
        };
        break;
      case "weekly":
        const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay()));
        dateQuery.createdAt = {
          $gte: new Date(startOfWeek.setHours(0, 0, 0, 0)),
          $lte: new Date(),
        };
        break;
      case "monthly":
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        dateQuery.createdAt = {
          $gte: startOfMonth,
          $lte: new Date(),
        };
        break;
      case "custom":
        if (startDate && endDate) {
          dateQuery.createdAt = {
            $gte: new Date(startDate),
            $lte: new Date(new Date(endDate).setHours(23, 59, 59, 999)),
          };
        }
        break;
    }
    const orders=await Order.find(dateQuery)
                           .populate('items.productId','title author')
                           .populate('userId','name email')
                           .sort({createdAt:-1})
console.log('exceldwnld orders..',orders)
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Sales Report");
    worksheet.columns = [
      { header: "Order ID", key: "orderId", width: 20 },
      { header: "Date", key: "date", width: 15 },
      { header: "Customer", key: "customer", width: 25 },
      { header: "Shipping Address", key: "shippingAddress", width: 40 },
      { header: "Products", key: "products", width: 50 },
      { header: "Total Amount", key: "totalAmount", width: 15 },
      { header: "Coupon Discount", key: "couponDiscount", width: 15 },
      { header: "Final Amount", key: "finalAmount", width: 15 },
      { header: "Payment Method", key: "paymentMethod", width: 15 },
      { header: "Status", key: "status", width: 15 },
    ];

    orders.forEach((order)=>{
        worksheet.addRow({
            orderId:order.OrderId,
            date: new Date(order.createdAt).toLocaleDateString(),
            customer:order.userId?`${order.userId.name} (${order.userId.email})`:'N/A',
            shippingAddress:order.address,
            products:order.items.map(
                (item)=>`${
                    item.productId 
                    ?`${item.productId.title} (${item.productId.author})`
                    :'N/A'
                } - ${item.quantity} pcs @ ₹${item.priceAtOrder}`
            ).join(" , "),
            totalAmount:`${order.total.toFixed(2)}`,
            couponDiscount:`${order.discount.toFixed(2)}`,
            finalAmount:`${(order.total-order.discount).toFixed(2)}`,
            paymentMethod:order.paymentMethod.toUpperCase(),
            status:order.status.charAt(0).toUpperCase() + order.status.slice(1),
        })
    })

    const totalOrders=orders.length;
    const totalAmount=orders.reduce(
        (sum,ord)=>sum+ord.total,0
    )
    const totalDiscount=orders.reduce(
        (sum,ord)=>sum+(ord.discount||0),0
    )
    const finalAmount=totalAmount-totalDiscount

    worksheet.addRow({});
    worksheet.addRow(["Summary"]);
    worksheet.addRow(["Total Orders", totalOrders]);
    worksheet.addRow(["Total Sales", `₹${totalAmount.toFixed(2)}`]);
    worksheet.addRow(["Total Discount", `₹${totalDiscount.toFixed(2)}`]);
    worksheet.addRow(["Net Sales", `₹${finalAmount.toFixed(2)}`]);

    // Set response headers
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=sales-report-${Date.now()}.xlsx`
    );

    // Write to response
    await workbook.xlsx.write(res);
    res.end();

    } catch (error) {
        console.error("Excel Download Error:", error);
        res.status(500).send("Error generating Excel: " + error.message);      
    }

}

const downloadPdf=async (req,res)=>{
    try {
        const { reportType, startDate, endDate } = req.query;

        // Validate report type
        if (!reportType) {
            return res
                .status(400)
                .json({ success: false, message: "Report type is required." });
        }

        // Construct date query
        const now = new Date();
        let dateQuery = {paymentStatus:'paid'}//{ status: "delivered" };

        switch (reportType) {
            case "daily":
                dateQuery.createdAt = {
                   $gte: new Date(now.setHours(0, 0, 0, 0)),
                   $lte: new Date(now.setHours(23, 59, 59, 999)),
                };
            break;
            case "weekly":
                const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay()));
                dateQuery.createdAt = {
                    $gte: new Date(startOfWeek.setHours(0, 0, 0, 0)),
                    $lte: new Date(),
                };
            break;
            case "monthly":
                const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
                dateQuery.createdAt = {
                    $gte: startOfMonth,
                    $lte: new Date(),
                };
            break;
            case "custom":
                if (!startDate || !endDate) {
                    return res.status(400).json({
                        success: false,
                        message: "Start and end dates are required for custom reports.",
                    });
                }
                dateQuery.createdAt = {
                    $gte: new Date(startDate),
                    $lte: new Date(new Date(endDate).setHours(23, 59, 59, 999)),
                };
            break;
            default:
                return res
                    .status(400)
                    .json({ success: false, message: "Invalid report type." });
        }
        const salesData = await Order.find(dateQuery)
                                     .populate('userId','name email')
                                     .populate('items.productId','title price')
                                     .sort({createdAt:-1})
        if (!salesData.length) {
            return res.status(404).json({
                success: false,
                message: "No sales data found for the specified period.",
            });
        }

        const doc= new jsPDF()
        //title
        doc.setFontSize(16)
        doc.text("Sales Report", 105, 10, { align: "center" })
        //metadata
        doc.getFontSize(10)
        doc.text(`Report Type: ${reportType.charAt(0).toUpperCase()+reportType.slice(1)}`, 14, 20);
        doc.text(`Generated On: ${new Date().toLocaleString()}`, 14, 30);

        const tableData=salesData.map((order)=>[
            order.OrderId,
            order.userId?order.userId.name:'N/A',
            order.items.map((item)=>item.productId?.title).join(', '),
            order.total.toFixed(2),
            order.discount?order.discount.toFixed(2):'0.00',
            (order.total-(order.discount||0)).toFixed(2),
            order.paymentMethod.toUpperCase(),
            new Date(order.createdAt).toLocaleString(),
        ])

        doc.autoTable({
            startY: 40,
            head: [
                [
                    "Order ID",
                    "Customer",
                    "Products",
                    "Total Amount",
                    "Discount",
                    "Final Amount",
                    "Payment Method",
                    "Order Date",
                ],
            ],
            body: tableData,
            theme: "grid",
            headStyles: { fillColor: [41, 128, 185], textColor: [255, 255, 255] },
            styles: { fontSize: 8, cellPadding: 2 },
        })

        const totalOrders=salesData.length;
        const totalSales=salesData.reduce((acc,ord)=>acc+ord.total,0).toFixed(2)
        const totalDiscount=salesData.reduce((acc,ord)=>acc+(ord.discount||0),0).toFixed(2)

        doc.addPage();
        doc.text("Sales Summary", 105, 10, { align: "center" });
        doc.autoTable({
            startY: 20,
            head: [["Metric", "Value"]],
            body: [
                ["Total Orders", totalOrders],
                ["Total Sales", `${totalSales}/-`],
                ["Total Discount", `${totalDiscount}/-`],
            ],
            theme: "grid",
            styles: { fontSize: 10, cellPadding: 2 },   
        })

        const pdfBuffer=Buffer.from(doc.output("arraybuffer"));

        // Set response headers
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader(
            "Content-Disposition",
            `attachment; filename=sales-report-${Date.now()}.pdf`
        );
        res.setHeader("Content-Length", pdfBuffer.length);

        // Send PDF
        res.send(pdfBuffer);


    } catch (error) {
        console.error("Error generating PDF:", error);
        res.status(500).json({
            success: false,
            message: "Error generating PDF",
            error: error.message,
        });
    }

}
module.exports={
    renderSalesReport,
    getSalesReport,
    downloadExcel,
    downloadPdf,
}