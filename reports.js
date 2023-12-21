
const reports = [];

const shareReportsData = (req, res, next) => {
  req.reports = reports;
  next();
};

export { reports, shareReportsData };
